const assert = require("node:assert/strict");
const { describe, it } = require("node:test");
const { _test } = require("./index.js");

class MemoryCollection {
  constructor(name, store) {
    this.name = name;
    this.store = store;
    this.criteria = {};
    this.sortField = "";
    this.sortDirection = "asc";
    this.limitCount = 0;
  }

  where(criteria) {
    const next = new MemoryCollection(this.name, this.store);
    next.criteria = criteria;
    next.sortField = this.sortField;
    next.sortDirection = this.sortDirection;
    next.limitCount = this.limitCount;
    return next;
  }

  orderBy(field, direction) {
    const next = new MemoryCollection(this.name, this.store);
    next.criteria = this.criteria;
    next.sortField = field;
    next.sortDirection = direction;
    next.limitCount = this.limitCount;
    return next;
  }

  limit(count) {
    const next = new MemoryCollection(this.name, this.store);
    next.criteria = this.criteria;
    next.sortField = this.sortField;
    next.sortDirection = this.sortDirection;
    next.limitCount = count;
    return next;
  }

  async get() {
    let data = Object.values(this.store[this.name] || {}).filter((item) =>
      Object.entries(this.criteria).every(([key, value]) => item[key] === value)
    );

    if (this.sortField) {
      const direction = this.sortDirection === "desc" ? -1 : 1;
      data = data.sort((left, right) => {
        const leftValue = left[this.sortField] instanceof Date ? left[this.sortField].getTime() : left[this.sortField];
        const rightValue = right[this.sortField] instanceof Date ? right[this.sortField].getTime() : right[this.sortField];
        if (leftValue === rightValue) return 0;
        return leftValue > rightValue ? direction : -direction;
      });
    }

    if (this.limitCount > 0) {
      data = data.slice(0, this.limitCount);
    }

    return { data };
  }

  doc(id) {
    return {
      get: async () => {
        const item = this.store[this.name]?.[id];
        if (!item) {
          throw new Error("document not found");
        }
        return { data: item };
      },
      set: async ({ data }) => {
        this.store[this.name] = this.store[this.name] || {};
        this.store[this.name][id] = data;
        return { _id: id };
      }
    };
  }
}

function createDb(seed = {}) {
  const store = {
    ponds: {},
    records: {},
    sync_revisions: {},
    ...seed
  };
  return {
    store,
    async createCollection(name) {
      if (store[name]) {
        throw new Error("collection already exists");
      }
      store[name] = {};
      return {};
    },
    collection(name) {
      return new MemoryCollection(name, store);
    },
    serverDate() {
      return new Date("2026-07-05T00:00:00.000Z");
    }
  };
}

function createEmptyDb() {
  const store = {};
  return {
    store,
    async createCollection(name) {
      if (store[name]) {
        throw new Error("collection already exists");
      }
      store[name] = {};
      return {};
    },
    collection(name) {
      return new MemoryCollection(name, store);
    },
    serverDate() {
      return new Date("2026-07-05T00:00:00.000Z");
    }
  };
}

describe("syncAccountData cloud function", () => {
  it("sanitizes client owner fields", () => {
    const payload = _test.normalizePayload({
      deviceId: "device-1",
      ponds: [{ id: "pond-1", name: "Pond", ownerUserId: "usr_other" }],
      records: [{ id: "record-1", pondId: "pond-1", type: "feed", ownerUserId: "usr_other" }]
    });

    assert.equal(payload.deviceId, "device-1");
    assert.equal("ownerUserId" in payload.ponds[0], false);
    assert.equal("ownerUserId" in payload.records[0], false);
  });

  it("rejects records referencing ponds not owned by the current openid", async () => {
    const db = createDb({
      ponds: {
        openid_a_pond_a: { _openid: "openid_a", pondId: "pond_a", payload: { id: "pond_a" } }
      }
    });

    await assert.rejects(
      () =>
        _test.pushOwnedState(db, "openid_b", {
          deviceId: "device-b",
          ponds: [],
          records: [{ id: "record-b", pondId: "pond_a", type: "feed" }]
        }),
      /pond not found/
    );
  });

  it("creates required collections in a fresh CloudBase database", async () => {
    const db = createEmptyDb();

    const result = await _test.main({ action: "pull" }, {}, { db, wxContext: { OPENID: "openid_a" } });

    assert.deepEqual(Object.keys(db.store).sort(), ["ponds", "records", "sync_revisions"]);
    assert.deepEqual(result, { serverRevision: 0, ponds: [], records: [] });
  });

  it("pushes and pulls only current openid data", async () => {
    const db = createDb({
      ponds: {
        openid_b_pond_b: { _openid: "openid_b", pondId: "pond_b", payload: { id: "pond_b", name: "Other" } }
      },
      records: {},
      sync_revisions: {}
    });

    await _test.main(
      {
        action: "push",
        payload: {
          deviceId: "device-a",
          ponds: [{ id: "pond_a", name: "Mine", ownerUserId: "usr_other" }],
          records: [{ id: "record_a", pondId: "pond_a", type: "water", ownerUserId: "usr_other" }]
        }
      },
      {},
      { db, wxContext: { OPENID: "openid_a" } }
    );

    const userA = await _test.main({ action: "pull" }, {}, { db, wxContext: { OPENID: "openid_a" } });
    const userB = await _test.main({ action: "pull" }, {}, { db, wxContext: { OPENID: "openid_b" } });

    assert.equal(userA.serverRevision, 1);
    assert.deepEqual(userA.ponds.map((pond) => pond.id), ["pond_a"]);
    assert.deepEqual(userA.records.map((record) => record.id), ["record_a"]);
    assert.deepEqual(userB.ponds.map((pond) => pond.id), ["pond_b"]);
    assert.deepEqual(userB.records, []);
  });
});
