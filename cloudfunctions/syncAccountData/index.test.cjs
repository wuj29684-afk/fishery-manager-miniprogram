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
  const store = { ponds: {}, records: {}, sync_revisions: {}, ...seed };
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

describe("syncAccountData v2", () => {
  it("sanitizes client owner fields", () => {
    const payload = _test.normalizePayload(v2Payload([{ ...pond("pond-a"), ownerUserId: "other" }], []));
    assert.equal("ownerUserId" in payload.ponds[0], false);
  });

  it("pushes and pulls only current openid data", async () => {
    const db = createDb();
    await _test.main({ action: "push", payload: v2Payload([pond("pond-a")], [record("record-a")]) }, {}, { db, wxContext: { OPENID: "openid-a" } });
    const a = await _test.main({ action: "pull" }, {}, { db, wxContext: { OPENID: "openid-a" } });
    const b = await _test.main({ action: "pull" }, {}, { db, wxContext: { OPENID: "openid-b" } });
    assert.deepEqual(a.records.map((item) => item.id), ["record-a"]);
    assert.deepEqual(b.records, []);
  });

  it("returns conflict for stale base revision", async () => {
    const db = createDb({ sync_revisions: { "openid-a_revision": { _openid: "openid-a", revision: 3 } } });
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
    for (let index = 0; index < 550; index += 1) records["openid-a-r-" + index] = { _openid: "openid-a", recordId: "r-" + index, payload: record("r-" + index), updatedAt: new Date() };
    const db = createDb({ ponds: { "openid-a_pond-a": { _openid: "openid-a", pondId: "pond-a", payload: pond("pond-a"), updatedAt: new Date() } }, records });
    const result = await _test.pullOwnedState(db, "openid-a");
    assert.equal(result.recordCount, 550);
    assert.equal(result.records.length, 550);
  });

  it("legacy push preserves fields unknown to 0.2.4", async () => {
    const db = createDb({ ponds: { "openid-a_pond-a": { _openid: "openid-a", pondId: "pond-a", payload: { ...pond("pond-a"), stockingDate: "2026-07-01" }, updatedAt: new Date() } } });
    await _test.pushOwnedState(db, "openid-a", { deviceId: "old", ponds: [{ id: "pond-a", name: "旧客户端", species: "罗非鱼" }], records: [] });
    const result = await _test.pullOwnedState(db, "openid-a");
    assert.equal(result.ponds[0].stockingDate, "2026-07-01");
  });

  it("rejects invalid integrity summary", () => {
    assert.throws(() => _test.normalizePayload({ ...v2Payload([pond("pond-a")], []), checksum: "bad" }), /checksum/);
  });
});
