let cloud;

try {
  cloud = require("wx-server-sdk");
} catch (_error) {
  cloud = {
    DYNAMIC_CURRENT_ENV: "test",
    init() {},
    database() {
      throw new Error("wx-server-sdk is required in CloudBase runtime");
    },
    getWXContext() {
      return {};
    }
  };
}

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV });

const REQUIRED_COLLECTIONS = ["ponds", "records", "sync_revisions"];

function stripOwner(item) {
  const { ownerUserId, ...rest } = item || {};
  return rest;
}

async function ensureCollections(db) {
  if (typeof db.createCollection !== "function") {
    return;
  }

  await Promise.all(
    REQUIRED_COLLECTIONS.map((name) =>
      db.createCollection(name).catch((error) => {
        const message = String(error && (error.errMsg || error.message || error));
        if (/exist|already|duplicate/i.test(message)) {
          return;
        }
        throw error;
      })
    )
  );
}

function normalizePayload(payload = {}) {
  return {
    deviceId: String(payload.deviceId || ""),
    lastSyncedAt: payload.lastSyncedAt,
    ponds: Array.isArray(payload.ponds) ? payload.ponds.map(stripOwner) : [],
    records: Array.isArray(payload.records) ? payload.records.map(stripOwner) : []
  };
}

function getRevisionDocId(openid) {
  return `${openid}_revision`;
}

function getPondDocId(openid, pondId) {
  return `${openid}_${pondId}`;
}

function getRecordDocId(openid, recordId) {
  return `${openid}_${recordId}`;
}

async function pullOwnedState(db, openid) {
  const [revisionResult, pondResult, recordResult] = await Promise.all([
    db.collection("sync_revisions").where({ _openid: openid }).limit(1).get(),
    db.collection("ponds").where({ _openid: openid }).orderBy("updatedAt", "desc").get(),
    db.collection("records").where({ _openid: openid }).orderBy("createdAt", "desc").get()
  ]);

  return {
    serverRevision: revisionResult.data[0]?.revision || 0,
    ponds: pondResult.data.map((item) => item.payload),
    records: recordResult.data.map((item) => item.payload)
  };
}

async function pushOwnedState(db, openid, rawPayload) {
  const payload = normalizePayload(rawPayload);
  const pushedPondIds = new Set(payload.ponds.map((pond) => pond.id));
  const existingPonds = await db.collection("ponds").where({ _openid: openid }).get();
  const ownedPondIds = new Set(existingPonds.data.map((item) => item.pondId));

  for (const record of payload.records) {
    if (!pushedPondIds.has(record.pondId) && !ownedPondIds.has(record.pondId)) {
      const error = new Error("pond not found");
      error.statusCode = 400;
      throw error;
    }
  }

  const now = db.serverDate();
  await Promise.all([
    ...payload.ponds.map((pond) =>
      db.collection("ponds").doc(getPondDocId(openid, pond.id)).set({
        data: {
          _openid: openid,
          pondId: pond.id,
          payload: pond,
          updatedAt: now
        }
      })
    ),
    ...payload.records.map((record) =>
      db.collection("records").doc(getRecordDocId(openid, record.id)).set({
        data: {
          _openid: openid,
          recordId: record.id,
          pondId: record.pondId,
          payload: record,
          createdAt: record.createdAt ? new Date(record.createdAt) : now,
          updatedAt: now
        }
      })
    )
  ]);

  const revisionDoc = db.collection("sync_revisions").doc(getRevisionDocId(openid));
  const currentRevision = await revisionDoc.get().catch(() => ({ data: null }));
  await revisionDoc.set({
    data: {
      _openid: openid,
      revision: (currentRevision.data?.revision || 0) + 1,
      updatedAt: now
    }
  });

  return pullOwnedState(db, openid);
}

async function main(event, _context, deps = {}) {
  const wxContext = deps.wxContext || cloud.getWXContext();
  const openid = wxContext.OPENID;
  if (!openid) {
    throw new Error("missing openid");
  }

  const db = deps.db || cloud.database();
  await ensureCollections(db);
  if (event.action === "push") {
    return pushOwnedState(db, openid, event.payload);
  }
  if (event.action === "pull") {
    return pullOwnedState(db, openid);
  }

  const error = new Error("unsupported action");
  error.statusCode = 400;
  throw error;
}

exports.main = main;
exports._test = {
  ensureCollections,
  normalizePayload,
  pullOwnedState,
  pushOwnedState,
  main
};
