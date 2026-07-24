let cloud;
try {
  cloud = require("wx-server-sdk");
} catch (_error) {
  cloud = {
    DYNAMIC_CURRENT_ENV: "test",
    init() {},
    database() { throw new Error("wx-server-sdk is required in CloudBase runtime"); },
    getWXContext() { return {}; }
  };
}

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });
const REQUIRED_COLLECTIONS = ["ponds", "records", "sync_revisions", "v4_states", "invitations", "memberships"];
const PAGE_SIZE = 100;
const MAX_ITEMS = 5000;
const CURRENT_DATA_EPOCH = 3;

function stripOwner(item) {
  const { ownerUserId, ...rest } = item || {};
  return rest;
}

function checksum(ponds, records) {
  const source = [...ponds, ...records]
    .map((item) => item.id + ":" + (item.updatedAt || ""))
    .sort()
    .join("|");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

async function ensureCollections(db) {
  if (typeof db.createCollection !== "function") return;
  await Promise.all(
    REQUIRED_COLLECTIONS.map((name) =>
      db.createCollection(name).catch((error) => {
        const message = String(error && (error.errMsg || error.message || error));
        if (!/exist|already|duplicate/i.test(message)) throw error;
      })
    )
  );
}

function normalizePayload(payload = {}) {
  const ponds = Array.isArray(payload.ponds) ? payload.ponds.map(stripOwner) : [];
  const records = Array.isArray(payload.records) ? payload.records.map(stripOwner) : [];
  if (ponds.length > MAX_ITEMS || records.length > MAX_ITEMS) throw new Error("sync payload too large");
  if (payload.protocolVersion === 2 || payload.protocolVersion === 3) {
    if (payload.schemaVersion !== 2) throw new Error("unsupported schema version");
    if (payload.pondCount !== ponds.length || payload.recordCount !== records.length) throw new Error("sync count mismatch");
    if (payload.checksum !== checksum(ponds, records)) throw new Error("sync checksum mismatch");
  }
  return {
    protocolVersion: payload.protocolVersion === 3 ? 3 : payload.protocolVersion === 2 ? 2 : 1,
    schemaVersion: payload.schemaVersion === 2 ? 2 : 1,
    deviceId: String(payload.deviceId || ""),
    baseRevision: Number(payload.baseRevision || 0),
    force: payload.force === true,
    ponds,
    records,
    deletedPondIds: Array.isArray(payload.deletedPondIds) ? payload.deletedPondIds.map(String) : [],
    deletedRecordIds: Array.isArray(payload.deletedRecordIds) ? payload.deletedRecordIds.map(String) : []
  };
}

const revisionId = (openid, dataEpoch) => dataEpoch === null ? openid + "_revision" : openid + "_revision_v" + dataEpoch;
const pondDocId = (openid, id, dataEpoch) => dataEpoch === null ? openid + "_" + id : openid + "_v" + dataEpoch + "_" + id;
const recordDocId = (openid, id, dataEpoch) => dataEpoch === null ? openid + "_" + id : openid + "_v" + dataEpoch + "_" + id;

function missingError(error) {
  return /not.*exist|not.*found|does not exist|不存在|未找到/i.test(String(error && (error.errMsg || error.message || error)));
}

async function pullAll(db, collectionName, openid, orderField, dataEpoch = null) {
  const data = [];
  for (let offset = 0; offset < MAX_ITEMS; offset += PAGE_SIZE) {
    const scope = dataEpoch === null ? { _openid: openid } : { _openid: openid, dataEpoch };
    let query = db.collection(collectionName).where(scope).orderBy(orderField, "desc").skip(offset).limit(PAGE_SIZE);
    const result = await query.get().catch((error) => {
      if (missingError(error)) return { data: [] };
      throw error;
    });
    data.push(...result.data);
    if (result.data.length < PAGE_SIZE) break;
  }
  return data;
}

async function getRevision(db, openid, dataEpoch = CURRENT_DATA_EPOCH) {
  const result = await db.collection("sync_revisions").doc(revisionId(openid, dataEpoch)).get().catch(() => ({ data: null }));
  return Number(result.data && result.data.revision || 0);
}

async function pullOwnedState(db, openid, dataEpoch = CURRENT_DATA_EPOCH) {
  const [serverRevision, pondDocs, recordDocs] = await Promise.all([
    getRevision(db, openid, dataEpoch),
    pullAll(db, "ponds", openid, "updatedAt", dataEpoch),
    pullAll(db, "records", openid, "updatedAt", dataEpoch)
  ]);
  const ponds = pondDocs.map((item) => item.payload);
  const records = recordDocs.map((item) => item.payload);
  return {
    protocolVersion: dataEpoch === 3 ? 3 : 2,
    schemaVersion: 2,
    serverRevision,
    syncedAt: new Date().toISOString(),
    ponds,
    records,
    pondCount: ponds.length,
    recordCount: records.length,
    checksum: checksum(ponds, records)
  };
}

async function removeDoc(collection, id) {
  await collection.doc(id).remove().catch((error) => {
    if (!missingError(error)) throw error;
  });
}

async function setCompatibleDoc(collection, id, data, legacy) {
  if (!legacy) return collection.doc(id).set({ data });
  const existing = await collection.doc(id).get().catch(() => ({ data: null }));
  return collection.doc(id).set({
    data: {
      ...data,
      payload: { ...(existing.data && existing.data.payload || {}), ...data.payload }
    }
  });
}

async function pushOwnedState(db, openid, rawPayload) {
  const payload = normalizePayload(rawPayload);
  const dataEpoch = payload.protocolVersion === 3 ? CURRENT_DATA_EPOCH : payload.protocolVersion === 2 ? 2 : null;
  const currentRevision = await getRevision(db, openid, dataEpoch);
  if ((payload.protocolVersion === 2 || payload.protocolVersion === 3) && !payload.force && payload.baseRevision !== currentRevision) {
    const current = await pullOwnedState(db, openid, dataEpoch);
    return { ...current, conflict: true };
  }

  const pushedPondIds = new Set(payload.ponds.map((pond) => pond.id));
  const existingPonds = await pullAll(db, "ponds", openid, "updatedAt", dataEpoch);
  const ownedPondIds = new Set(existingPonds.map((item) => item.pondId));
  for (const pond of payload.ponds) {
    if (!pond.id || !pond.name || !pond.species) throw new Error("invalid pond");
  }
  for (const record of payload.records) {
    if (!record.id || !record.pondId || !record.type || !record.date) throw new Error("invalid record");
    if (!pushedPondIds.has(record.pondId) && !ownedPondIds.has(record.pondId)) throw new Error("pond not found");
  }

  const now = db.serverDate();
  const legacy = payload.protocolVersion === 1;
  await Promise.all([
    ...payload.ponds.map((pond) =>
      setCompatibleDoc(db.collection("ponds"), pondDocId(openid, pond.id, dataEpoch), {
        _openid: openid, ...(dataEpoch === null ? {} : { dataEpoch }), pondId: pond.id, payload: pond, updatedAt: now
      }, legacy)
    ),
    ...payload.records.map((record) =>
      setCompatibleDoc(db.collection("records"), recordDocId(openid, record.id, dataEpoch), {
        _openid: openid, ...(dataEpoch === null ? {} : { dataEpoch }), recordId: record.id, pondId: record.pondId, payload: record,
        createdAt: record.createdAt ? new Date(record.createdAt) : now, updatedAt: now
      }, legacy)
    ),
    ...payload.deletedRecordIds.map((id) => removeDoc(db.collection("records"), recordDocId(openid, id, dataEpoch))),
    ...payload.deletedPondIds.map((id) => removeDoc(db.collection("ponds"), pondDocId(openid, id, dataEpoch)))
  ]);

  await db.collection("sync_revisions").doc(revisionId(openid, dataEpoch)).set({
    data: {
      _openid: openid,
      ...(dataEpoch === null ? {} : { dataEpoch }),
      revision: currentRevision + 1,
      deviceId: payload.deviceId,
      schemaVersion: payload.schemaVersion,
      updatedAt: now
    }
  });
  return pullOwnedState(db, openid, dataEpoch);
}

function sanitizeV4State(rawState, openid) {
  if (!rawState || rawState.version !== 3) throw new Error("invalid v4 state");
  const listKeys = [
    "farms", "members", "units", "batches", "records", "inventory", "inventoryMovements",
    "tasks", "templates", "deletionAudit", "telemetry"
  ];
  for (const key of listKeys) {
    if (!Array.isArray(rawState[key]) || rawState[key].length > MAX_ITEMS) throw new Error("invalid v4 " + key);
  }
  const state = JSON.parse(JSON.stringify(rawState));
  state.auth = { ...state.auth, status: "bound", userId: openid };
  state.farms = state.farms.map((farm) => ({ ...farm, ownerUserId: openid }));
  state.members = state.members.map((member) =>
    member.role === "owner" ? { ...member, userId: openid } : member
  );
  state.telemetry = state.telemetry.slice(-200);
  return state;
}

async function getV4Document(db, openid) {
  const result = await db.collection("v4_states").doc(openid).get().catch(() => ({ data: null }));
  return result.data;
}

async function syncV4State(db, openid, rawState, baseRevision) {
  await ensureCollections(db);
  let ownerOpenid = openid;
  let membership = null;
  let existing = await getV4Document(db, ownerOpenid);
  if (!existing) {
    const memberships = await db.collection("memberships").where({ memberOpenid: openid, status: "active" }).limit(1).get().catch(() => ({ data: [] }));
    membership = memberships.data[0] || null;
    ownerOpenid = membership && membership.ownerOpenid;
    existing = ownerOpenid ? await getV4Document(db, ownerOpenid) : null;
  }
  const revision = Number(existing && existing.revision || 0);
  if (existing && Number(baseRevision || 0) !== revision) {
    return { state: stateForUser(existing.state, openid), revision, syncedAt: existing.syncedAt, conflict: true };
  }
  if (membership) {
    const member = existing.state.members.find((item) => item.userId === openid && item.status === "active");
    if (!member) throw new Error("recorder access is not active");
    const immutableKeys = ["farms", "members", "units", "batches", "inventory", "inventoryMovements", "tasks", "templates"];
    for (const key of immutableKeys) {
      if (JSON.stringify(rawState[key]) !== JSON.stringify(existing.state[key])) throw new Error("recorder cannot change " + key);
    }
    const submittedOwn = rawState.records.filter((record) => record.createdBy === openid);
    if (submittedOwn.some((record) => member.unitIds.length && !member.unitIds.includes(record.unitId))) {
      throw new Error("recorder unit access denied");
    }
    const records = [
      ...existing.state.records.filter((record) => record.createdBy !== openid),
      ...submittedOwn.map((record) => ({ ...record, createdBy: openid, updatedBy: openid }))
    ];
    const state = { ...existing.state, records };
    const syncedAt = new Date().toISOString();
    await db.collection("v4_states").doc(ownerOpenid).set({
      data: { ...existing, state, revision: revision + 1, syncedAt, updatedAt: db.serverDate() }
    });
    return { state: stateForUser(state, openid), revision: revision + 1, syncedAt, conflict: false };
  }
  const state = sanitizeV4State(rawState, openid);
  const syncedAt = new Date().toISOString();
  await db.collection("v4_states").doc(openid).set({
    data: { _openid: openid, state, revision: revision + 1, syncedAt, updatedAt: db.serverDate() }
  });
  return { state, revision: revision + 1, syncedAt, conflict: false };
}

function stateForUser(state, openid) {
  return {
    ...JSON.parse(JSON.stringify(state)),
    auth: { status: "bound", userId: openid, displayName: "微信用户" }
  };
}

function invitationCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let index = 0; index < 8; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

async function createInvitation(db, openid, farmId) {
  await ensureCollections(db);
  const document = await getV4Document(db, openid);
  const farm = document && document.state && document.state.farms.find((item) => item.id === farmId);
  if (!farm || farm.ownerUserId !== openid) throw new Error("only farm owner can invite");
  const code = invitationCode();
  await db.collection("invitations").doc(code).set({
    data: {
      code,
      farmId,
      ownerOpenid: openid,
      role: "recorder",
      status: "active",
      createdAt: db.serverDate()
    }
  });
  return { code };
}

async function acceptInvitation(db, openid, code) {
  const result = await db.collection("invitations").doc(code).get().catch(() => ({ data: null }));
  const invite = result.data;
  if (!invite || invite.status !== "active") throw new Error("invitation is invalid");
  const document = await getV4Document(db, invite.ownerOpenid);
  if (!document) throw new Error("farm owner data not found");
  if (document.state.members.filter((item) => item.role === "recorder").length >= 5) throw new Error("recorder limit reached");
  const now = new Date().toISOString();
  const member = {
    id: "member-" + openid,
    farmId: invite.farmId,
    userId: openid,
    displayName: "待确认成员",
    role: "recorder",
    unitIds: [],
    canViewFinance: false,
    status: "paused",
    createdAt: now,
    updatedAt: now
  };
  const state = { ...document.state, members: [...document.state.members.filter((item) => item.userId !== openid), member] };
  await Promise.all([
    db.collection("v4_states").doc(invite.ownerOpenid).set({ data: { ...document, state, revision: document.revision + 1, updatedAt: db.serverDate() } }),
    db.collection("memberships").doc(openid + "_" + invite.ownerOpenid).set({
      data: { memberOpenid: openid, ownerOpenid: invite.ownerOpenid, farmId: invite.farmId, status: "paused" }
    }),
    db.collection("invitations").doc(code).set({ data: { ...invite, status: "used", usedBy: openid } })
  ]);
  return { member };
}

async function approveMember(db, openid, userId, unitIds, canViewFinance) {
  const document = await getV4Document(db, openid);
  if (!document) throw new Error("owner data not found");
  const member = document.state.members.find((item) => item.userId === userId && item.role === "recorder");
  if (!member) throw new Error("member not found");
  const allowedUnits = unitIds.filter((id) => document.state.units.some((unit) => unit.id === id && unit.farmId === member.farmId));
  const state = {
    ...document.state,
    members: document.state.members.map((item) => item.userId === userId
      ? { ...item, unitIds: allowedUnits, canViewFinance: canViewFinance === true, status: "active", updatedAt: new Date().toISOString() }
      : item)
  };
  await Promise.all([
    db.collection("v4_states").doc(openid).set({ data: { ...document, state, revision: document.revision + 1, updatedAt: db.serverDate() } }),
    db.collection("memberships").doc(userId + "_" + openid).set({
      data: { memberOpenid: userId, ownerOpenid: openid, farmId: member.farmId, status: "active" }
    })
  ]);
  return { approved: true };
}

async function pullMemberState(db, openid) {
  const memberships = await db.collection("memberships").where({ memberOpenid: openid, status: "active" }).limit(1).get().catch(() => ({ data: [] }));
  const membership = memberships.data[0];
  if (!membership) throw new Error("active membership not found");
  const document = await getV4Document(db, membership.ownerOpenid);
  if (!document) throw new Error("owner data not found");
  return { state: stateForUser(document.state, openid), revision: document.revision, syncedAt: document.syncedAt };
}

async function deleteV4Account(db, openid) {
  await removeDoc(db.collection("v4_states"), openid);
  const invitations = await db.collection("invitations").where({ ownerOpenid: openid }).limit(MAX_ITEMS).get().catch(() => ({ data: [] }));
  await Promise.all(invitations.data.map((item) => removeDoc(db.collection("invitations"), item.code)));
  return { deleted: true };
}

async function main(event, _context, deps = {}) {
  const wxContext = deps.wxContext || cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) throw new Error("missing openid");
  const db = deps.db || cloud.database();
  if (event.action === "identity") return { openid };
  if (event.action === "v4Sync") return syncV4State(db, openid, event.state, event.baseRevision);
  if (event.action === "inviteCreate") return createInvitation(db, openid, String(event.farmId || ""));
  if (event.action === "inviteAccept") return acceptInvitation(db, openid, String(event.code || ""));
  if (event.action === "memberApprove") return approveMember(db, openid, String(event.userId || ""), Array.isArray(event.unitIds) ? event.unitIds.map(String) : [], event.canViewFinance);
  if (event.action === "v4MemberPull") return pullMemberState(db, openid);
  if (event.action === "v4DeleteAccount") return deleteV4Account(db, openid);
  if (event.action === "push") {
    await ensureCollections(db);
    return pushOwnedState(db, openid, event.payload);
  }
  if (event.action === "pull") return pullOwnedState(db, openid, event.protocolVersion === 3 ? CURRENT_DATA_EPOCH : event.protocolVersion === 2 ? 2 : null);
  throw new Error("unsupported action");
}

exports.main = main;
exports._test = {
  checksum, ensureCollections, normalizePayload, pullAll, pullOwnedState, pushOwnedState,
  sanitizeV4State, syncV4State, createInvitation, acceptInvitation, approveMember, pullMemberState,
  deleteV4Account, main, CURRENT_DATA_EPOCH
};
