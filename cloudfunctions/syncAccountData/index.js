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
const REQUIRED_COLLECTIONS = ["ponds", "records", "sync_revisions"];
const PAGE_SIZE = 100;
const MAX_ITEMS = 5000;
const CURRENT_DATA_EPOCH = 2;

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
  if (payload.protocolVersion === 2) {
    if (payload.schemaVersion !== 2) throw new Error("unsupported schema version");
    if (payload.pondCount !== ponds.length || payload.recordCount !== records.length) throw new Error("sync count mismatch");
    if (payload.checksum !== checksum(ponds, records)) throw new Error("sync checksum mismatch");
  }
  return {
    protocolVersion: payload.protocolVersion === 2 ? 2 : 1,
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
    protocolVersion: 2,
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
  const dataEpoch = payload.protocolVersion === 2 ? CURRENT_DATA_EPOCH : null;
  const currentRevision = await getRevision(db, openid, dataEpoch);
  if (payload.protocolVersion === 2 && !payload.force && payload.baseRevision !== currentRevision) {
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

async function main(event, _context, deps = {}) {
  const wxContext = deps.wxContext || cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) throw new Error("missing openid");
  const db = deps.db || cloud.database();
  if (event.action === "push") {
    await ensureCollections(db);
    return pushOwnedState(db, openid, event.payload);
  }
  if (event.action === "pull") return pullOwnedState(db, openid, event.protocolVersion === 2 ? CURRENT_DATA_EPOCH : null);
  throw new Error("unsupported action");
}

exports.main = main;
exports._test = { checksum, ensureCollections, normalizePayload, pullAll, pullOwnedState, pushOwnedState, main, CURRENT_DATA_EPOCH };
