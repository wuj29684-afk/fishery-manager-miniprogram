const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { _test } = require("./index.js");

class MemoryCollection {
  constructor(name, store, criteria = {}, offset = 0, limitCount = 0, sortField = "") {
    Object.assign(this, { name, store, criteria, offset, limitCount, sortField });
  }
  where(criteria) { return new MemoryCollection(this.name, this.store, criteria, this.offset, this.limitCount, this.sortField); }
  orderBy(field) { return new MemoryCollection(this.name, this.store, this.criteria, this.offset, this.limitCount, field); }
  skip(offset) { return new MemoryCollection(this.name, this.store, this.criteria, offset, this.limitCount, this.sortField); }
  limit(count) { return new MemoryCollection(this.name, this.store, this.criteria, this.offset, count, this.sortField); }
  async get() {
    let data = Object.values(this.store[this.name] || {}).filter((item) => Object.entries(this.criteria).every(([key, value]) => item[key] === value));
    if (this.sortField) data.sort((a, b) => String(b[this.sortField]).localeCompare(String(a[this.sortField])));
    return { data: data.slice(this.offset, this.limitCount ? this.offset + this.limitCount : undefined) };
  }
  doc(id) {
    return {
      get: async () => {
        const item = this.store[this.name]?.[id];
        if (!item) throw new Error("document not found");
        return { data: item };
      },
      set: async ({ data }) => {
        this.store[this.name] ||= {};
        this.store[this.name][id] = data;
        return { _id: id };
      },
      remove: async () => {
        if (!this.store[this.name]?.[id]) throw new Error("document not found");
        delete this.store[this.name][id];
      }
    };
  }
}

function createDb(seed = {}) {
  const store = { ponds: {}, records: {}, sync_revisions: {}, v4_states: {}, invitations: {}, memberships: {}, ...seed };
  return {
    store,
    async createCollection(name) { if (store[name]) throw new Error("collection already exists"); store[name] = {}; },
    collection(name) { return new MemoryCollection(name, store); },
    serverDate() { return new Date("2026-07-11T00:00:00.000Z"); }
  };
}

function pond(id, updatedAt = "2026-07-11T00:00:00.000Z") {
  return { id, name: id, species: "罗非鱼", updatedAt };
}
function record(id, pondId = "pond-a", updatedAt = "2026-07-11T00:00:00.000Z") {
  return { id, pondId, type: "feed", date: "2026-07-11", updatedAt };
}
function v2Payload(ponds, records, baseRevision = 0, extra = {}) {
  return {
    protocolVersion: 2, schemaVersion: 2, deviceId: "device-a", baseRevision, force: false,
    ponds, records, deletedPondIds: [], deletedRecordIds: [],
    pondCount: ponds.length, recordCount: records.length, checksum: _test.checksum(ponds, records), ...extra
  };
}

function v3Payload(ponds, records, baseRevision = 0, extra = {}) {
  return { ...v2Payload(ponds, records, baseRevision, extra), protocolVersion: 3 };
}

describe("syncAccountData v2", () => {
  it("sanitizes client owner fields", () => {
    const payload = _test.normalizePayload(v2Payload([{ ...pond("pond-a"), ownerUserId: "other" }], []));
    assert.equal("ownerUserId" in payload.ponds[0], false);
  });

  it("pushes and pulls only current openid data", async () => {
    const db = createDb();
    await _test.main({ action: "push", payload: v2Payload([pond("pond-a")], [record("record-a")]) }, {}, { db, wxContext: { OPENID: "openid-a" } });
    const a = await _test.main({ action: "pull", protocolVersion: 2 }, {}, { db, wxContext: { OPENID: "openid-a" } });
    const b = await _test.main({ action: "pull", protocolVersion: 2 }, {}, { db, wxContext: { OPENID: "openid-b" } });
    assert.deepEqual(a.records.map((item) => item.id), ["record-a"]);
    assert.deepEqual(b.records, []);
  });

  it("returns conflict for stale base revision", async () => {
    const db = createDb({ sync_revisions: { "openid-a_revision_v2": { _openid: "openid-a", dataEpoch: 2, revision: 3 } } });
    const result = await _test.pushOwnedState(db, "openid-a", v2Payload([pond("pond-a")], [], 2));
    assert.equal(result.conflict, true);
    assert.equal(result.serverRevision, 3);
  });

  it("deletes tombstoned records so they do not return", async () => {
    const db = createDb();
    await _test.pushOwnedState(db, "openid-a", v2Payload([pond("pond-a")], [record("record-a")]));
    const payload = v2Payload([pond("pond-a")], [], 1, { deletedRecordIds: ["record-a"] });
    const result = await _test.pushOwnedState(db, "openid-a", payload);
    assert.deepEqual(result.records, []);
  });

  it("pulls more than two database pages completely", async () => {
    const records = {};
    for (let index = 0; index < 550; index += 1) records["openid-a-r-" + index] = { _openid: "openid-a", dataEpoch: 2, recordId: "r-" + index, payload: record("r-" + index), updatedAt: new Date() };
    const db = createDb({ ponds: { "openid-a_pond-a": { _openid: "openid-a", dataEpoch: 2, pondId: "pond-a", payload: pond("pond-a"), updatedAt: new Date() } }, records });
    const result = await _test.pullOwnedState(db, "openid-a", 2);
    assert.equal(result.recordCount, 550);
    assert.equal(result.records.length, 550);
  });

  it("legacy push preserves fields unknown to 0.2.4", async () => {
    const db = createDb({ ponds: { "openid-a_pond-a": { _openid: "openid-a", pondId: "pond-a", payload: { ...pond("pond-a"), stockingDate: "2026-07-01" }, updatedAt: new Date() } } });
    await _test.pushOwnedState(db, "openid-a", { deviceId: "old", ponds: [{ id: "pond-a", name: "旧客户端", species: "罗非鱼" }], records: [] });
    const result = await _test.pullOwnedState(db, "openid-a", null);
    assert.equal(result.ponds[0].stockingDate, "2026-07-01");
  });

  it("rejects invalid integrity summary", () => {
    assert.throws(() => _test.normalizePayload({ ...v2Payload([pond("pond-a")], []), checksum: "bad" }), /checksum/);
  });

  it("starts v2 accounts from an empty data epoch while legacy pull remains available", async () => {
    const legacyPond = { _openid: "openid-a", pondId: "old-pond", payload: pond("old-pond"), updatedAt: new Date() };
    const db = createDb({ ponds: { "openid-a_old-pond": legacyPond } });
    const current = await _test.main({ action: "pull", protocolVersion: 2 }, {}, { db, wxContext: { OPENID: "openid-a" } });
    const legacy = await _test.main({ action: "pull" }, {}, { db, wxContext: { OPENID: "openid-a" } });
    assert.deepEqual(current.ponds, []);
    assert.deepEqual(legacy.ponds.map((item) => item.id), ["old-pond"]);
  });

  it("keeps protocol 3 data separate from protocol 2 data", async () => {
    const db = createDb();
    await _test.main({ action: "push", payload: v2Payload([pond("old-pond")], []) }, {}, { db, wxContext: { OPENID: "openid-a" } });
    const fresh = await _test.main({ action: "pull", protocolVersion: 3 }, {}, { db, wxContext: { OPENID: "openid-a" } });
    assert.deepEqual(fresh.ponds, []);
    await _test.main({ action: "push", payload: v3Payload([pond("new-pond")], []) }, {}, { db, wxContext: { OPENID: "openid-a" } });
    const old = await _test.main({ action: "pull", protocolVersion: 2 }, {}, { db, wxContext: { OPENID: "openid-a" } });
    assert.deepEqual(old.ponds.map((item) => item.id), ["old-pond"]);
  });
});

function v4State(owner = "client-owner") {
  return {
    version: 3,
    auth: { status: "bound", userId: owner, displayName: "负责人" },
    farms: [{ id: "farm-a", name: "测试场", ownerUserId: owner }],
    members: [{ id: "member-a", farmId: "farm-a", userId: owner, role: "owner", status: "active" }],
    units: [], batches: [], records: [], inventory: [], inventoryMovements: [], tasks: [], templates: [],
    deletionAudit: [], telemetry: [],
    settings: { selectedFarmId: "farm-a", selectedUnitId: "", weightUnit: "jin", quickRecordTypes: [], homeMode: "record", telemetryEnabled: true, autoSyncEnabled: true },
    syncMeta: { protocolVersion: 4, baseRevision: 0, pendingEntityIds: [], conflicts: [], status: "pending", lastSyncedAt: "", message: "" },
    migration: { sourceVersion: 3, migratedAt: "2026-07-11T00:00:00.000Z", legacyBackupCreated: true }
  };
}

describe("syncAccountData v4", () => {
  it("returns the trusted WeChat identity", async () => {
    const result = await _test.main({ action: "identity" }, {}, { db: createDb(), wxContext: { OPENID: "openid-a" } });
    assert.equal(result.openid, "openid-a");
  });

  it("stores state by openid and replaces client ownership fields", async () => {
    const db = createDb();
    const result = await _test.main({ action: "v4Sync", state: v4State("forged"), baseRevision: 0 }, {}, { db, wxContext: { OPENID: "openid-a" } });
    assert.equal(result.revision, 1);
    assert.equal(result.state.auth.userId, "openid-a");
    assert.equal(result.state.farms[0].ownerUserId, "openid-a");
    const other = await _test.main({ action: "v4Sync", state: v4State("forged"), baseRevision: 0 }, {}, { db, wxContext: { OPENID: "openid-b" } });
    assert.equal(other.state.auth.userId, "openid-b");
  });

  it("returns the remote state for a stale revision", async () => {
    const db = createDb();
    await _test.main({ action: "v4Sync", state: v4State(), baseRevision: 0 }, {}, { db, wxContext: { OPENID: "openid-a" } });
    const stale = await _test.main({ action: "v4Sync", state: { ...v4State(), records: [{ id: "local" }] }, baseRevision: 0 }, {}, { db, wxContext: { OPENID: "openid-a" } });
    assert.equal(stale.conflict, true);
    assert.equal(stale.revision, 1);
    assert.deepEqual(stale.state.records, []);
  });

  it("creates an owner-scoped invitation without leaking openid", async () => {
    const db = createDb();
    await _test.main({ action: "v4Sync", state: v4State(), baseRevision: 0 }, {}, { db, wxContext: { OPENID: "openid-a" } });
    const invite = await _test.main({ action: "inviteCreate", farmId: "farm-a" }, {}, { db, wxContext: { OPENID: "openid-a" } });
    assert.match(invite.code, /^[A-Z0-9]{8}$/);
    assert.equal(invite.code.includes("openid"), false);
  });

  it("deletes only the caller v4 state and invitations", async () => {
    const db = createDb();
    await _test.main({ action: "v4Sync", state: v4State(), baseRevision: 0 }, {}, { db, wxContext: { OPENID: "openid-a" } });
    await _test.main({ action: "v4Sync", state: v4State(), baseRevision: 0 }, {}, { db, wxContext: { OPENID: "openid-b" } });
    await _test.main({ action: "inviteCreate", farmId: "farm-a" }, {}, { db, wxContext: { OPENID: "openid-a" } });
    const deleted = await _test.main({ action: "v4DeleteAccount" }, {}, { db, wxContext: { OPENID: "openid-a" } });
    assert.equal(deleted.deleted, true);
    assert.equal(db.store.v4_states["openid-a"], undefined);
    assert.ok(db.store.v4_states["openid-b"]);
    assert.equal(Object.values(db.store.invitations).some((item) => item.ownerOpenid === "openid-a"), false);
  });

  it("requires owner approval and restricts a recorder to own records", async () => {
    const db = createDb();
    const ownerState = v4State();
    ownerState.units = [{ id: "unit-a", farmId: "farm-a", name: "一号池" }];
    ownerState.batches = [{ id: "batch-a", farmId: "farm-a", unitId: "unit-a", status: "culturing" }];
    await _test.main({ action: "v4Sync", state: ownerState, baseRevision: 0 }, {}, { db, wxContext: { OPENID: "openid-a" } });
    const invite = await _test.main({ action: "inviteCreate", farmId: "farm-a" }, {}, { db, wxContext: { OPENID: "openid-a" } });
    const joined = await _test.main({ action: "inviteAccept", code: invite.code }, {}, { db, wxContext: { OPENID: "openid-r" } });
    assert.equal(joined.member.status, "paused");
    await _test.main({ action: "memberApprove", userId: "openid-r", unitIds: ["unit-a"], canViewFinance: false }, {}, { db, wxContext: { OPENID: "openid-a" } });
    const pulled = await _test.main({ action: "v4MemberPull" }, {}, { db, wxContext: { OPENID: "openid-r" } });
    assert.equal(pulled.state.auth.userId, "openid-r");
    const changed = structuredClone(pulled.state);
    changed.records.push({
      id: "record-r", farmId: "farm-a", unitId: "unit-a", batchId: "batch-a", type: "feed",
      date: "2026-07-23", note: "", data: { weightKg: 1 }, photos: [], createdBy: "openid-r",
      updatedBy: "openid-r", createdAt: "2026-07-23T00:00:00.000Z", updatedAt: "2026-07-23T00:00:00.000Z"
    });
    const synced = await _test.main({ action: "v4Sync", state: changed, baseRevision: pulled.revision }, {}, { db, wxContext: { OPENID: "openid-r" } });
    assert.equal(synced.state.records.some((item) => item.id === "record-r"), true);
    changed.inventory.push({ id: "forbidden-change" });
    await assert.rejects(
      _test.main({ action: "v4Sync", state: changed, baseRevision: synced.revision }, {}, { db, wxContext: { OPENID: "openid-r" } }),
      /recorder cannot change/
    );
  });
});
