import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { mkdir, mkdtemp, symlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(join(tmpdir(), "fishery-v4-"));
const out = join(temp, "compiled");
await mkdir(out, { recursive: true });
await symlink(join(root, "node_modules"), join(temp, "node_modules"), "dir");

try {
  const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
  execFileSync(existsSync(localTsc) ? process.execPath : "tsc", [
    ...(existsSync(localTsc) ? [localTsc] : []),
    "--target", "ES2020", "--module", "commonjs", "--moduleResolution", "node",
    "--strict", "--skipLibCheck", "--esModuleInterop", "--rootDir", "src", "--outDir", out,
    "src/types/index.ts",
    "src/domain/farm-state.ts",
    "src/domain/alert-profiles.ts",
    "src/domain/withdrawal.ts",
    "src/v4/types.ts",
    "src/v4/state.ts",
    "src/v4/inventory.ts",
    "src/v4/metrics.ts",
    "src/v4/permissions.ts",
    "src/v4/merge.ts",
    "src/v4/backup.ts"
  ], { cwd: root, stdio: "inherit" });

  const require = createRequire(import.meta.url);
  const {
    addV4Record,
    createFarm,
    createUnit,
    createV4State,
    deleteV4Record,
    deleteUnitPermanent,
    finishBatch,
    migrateV2ToV4,
    resolveV4Conflict,
    startBatch,
    updateTaskCompletion
  } = require(join(out, "v4", "state.js"));
  const {
    convertWeightToKg,
    purchaseInventory,
    consumeInventory
  } = require(join(out, "v4", "inventory.js"));
  const {
    allocateSharedExpense,
    calculateBatchMetrics
  } = require(join(out, "v4", "metrics.js"));
  const { canMember } = require(join(out, "v4", "permissions.js"));
  const { mergeV4States } = require(join(out, "v4", "merge.js"));
  const { createCompleteBackupPackage, createCompleteEncryptedBackup, createEncryptedBackup, parseEncryptedBackup } = require(join(out, "v4", "backup.js"));

  const now = "2026-07-23T00:00:00.000Z";
  let state = createV4State(now, "owner-a");
  assert.equal(state.version, 3);
  assert.equal(state.settings.weightUnit, "jin");
  assert.equal(state.auth.status, "guest");

  state = createFarm(state, {
    name: "海丰养殖场",
    province: "广东省",
    city: "汕尾市",
    district: "海丰县"
  }, "owner-a", now);
  const farm = state.farms[0];
  assert.equal(farm.ownerUserId, "owner-a");
  assert.equal(state.members[0].role, "owner");

  state = createUnit(state, {
    farmId: farm.id,
    type: "pond",
    name: "东塘",
    location: "东区",
    areaMu: 6
  }, "owner-a", now);
  const unit = state.units[0];
  state = startBatch(state, {
    farmId: farm.id,
    unitId: unit.id,
    species: "南美白对虾",
    stockingDate: "2026-07-23",
    stockingQuantity: 300000,
    initialAverageWeightG: 0.02
  }, "owner-a", now);
  const batch = state.batches[0];
  assert.throws(
    () => startBatch(state, {
      farmId: farm.id,
      unitId: unit.id,
      species: "罗非鱼",
      stockingDate: "2026-07-23",
      stockingQuantity: 1000
    }, "owner-a", now),
    /进行中批次/
  );

  assert.equal(convertWeightToKg(80, "jin"), 40);
  state = purchaseInventory(state, {
    farmId: farm.id,
    kind: "feed",
    name: "对虾料",
    quantityKg: 1000,
    totalCostYuan: 6000
  }, "owner-a", now);
  state = purchaseInventory(state, {
    farmId: farm.id,
    kind: "feed",
    name: "对虾料",
    quantityKg: 500,
    totalCostYuan: 3300
  }, "owner-a", now);
  assert.equal(state.inventory[0].averageUnitCostYuan, 6.2);
  state = consumeInventory(state, state.inventory[0].id, 40, batch.id, "owner-a", now);
  assert.equal(state.inventory[0].quantityKg, 1460);

  state = addV4Record(state, {
    farmId: farm.id,
    unitId: unit.id,
    batchId: batch.id,
    type: "feed",
    date: "2026-07-23",
    note: "",
    data: { weightKg: 40, unitCostYuan: 6.2, feedName: "对虾料" }
  }, "owner-a", now);
  state = addV4Record(state, {
    farmId: farm.id,
    unitId: unit.id,
    batchId: batch.id,
    type: "sampling",
    date: "2026-07-23",
    note: "",
    data: { sampleCount: 30, averageWeightG: 2, estimatedStockQuantity: 285000 }
  }, "owner-a", now);
  state = addV4Record(state, {
    farmId: farm.id,
    unitId: unit.id,
    batchId: batch.id,
    type: "patrol",
    date: "2026-07-23",
    note: "摄食正常",
    data: { abnormal: false }
  }, "owner-a", now);
  assert.equal(state.records.length, 3);

  const metrics = calculateBatchMetrics(state, batch.id);
  assert.equal(metrics.feedKg, 40);
  assert.equal(metrics.estimatedStockQuantity, 285000);
  assert.equal(metrics.survivalRate, 95);
  assert.equal(metrics.fcr.value, null);
  assert.match(metrics.fcr.missingReason, /生物量/);

  const allocation = allocateSharedExpense(900, [
    { batchId: "a", weight: 2 },
    { batchId: "b", weight: 1 }
  ]);
  assert.deepEqual(allocation, [
    { batchId: "a", amountYuan: 600 },
    { batchId: "b", amountYuan: 300 }
  ]);

  const recorder = {
    id: "member-r",
    farmId: farm.id,
    userId: "recorder-a",
    displayName: "记录员",
    role: "recorder",
    unitIds: [unit.id],
    canViewFinance: false,
    status: "active"
  };
  assert.equal(canMember(recorder, "record:create", unit.id), true);
  assert.equal(canMember(recorder, "finance:view", unit.id), false);
  assert.equal(canMember(recorder, "farm:delete", unit.id), false);

  const base = structuredClone(state);
  const local = addV4Record(base, {
    farmId: farm.id, unitId: unit.id, batchId: batch.id, type: "water",
    date: "2026-07-23", note: "", data: { ph: 8.1, dissolvedOxygen: 6.2, ammoniaNitrogen: 0.05 }
  }, "owner-a", "2026-07-23T01:00:00.000Z");
  const remote = addV4Record(base, {
    farmId: farm.id, unitId: unit.id, batchId: batch.id, type: "mortality",
    date: "2026-07-23", note: "", data: { count: 20 }
  }, "recorder-a", "2026-07-23T02:00:00.000Z");
  const merged = mergeV4States(base, local, remote);
  assert.equal(merged.conflicts.length, 0);
  assert.equal(merged.state.records.length, base.records.length + 2);

  const recordId = state.records[0].id;
  state = deleteV4Record(state, recordId, "owner-a", now);
  assert.equal(state.records.some((record) => record.id === recordId), false);
  assert.equal(state.deletionAudit.at(-1).entityId, recordId);
  assert.equal(state.deletionAudit.at(-1).snapshot, undefined);

  state = updateTaskCompletion({
    ...state,
    tasks: [{
      id: "task-feed",
      farmId: farm.id,
      unitId: unit.id,
      batchId: batch.id,
      type: "feed",
      title: "今日投喂",
      schedule: "daily",
      enabled: true,
      createdAt: now,
      updatedAt: now
    }]
  }, "2026-07-23");
  assert.equal(state.tasks[0].lastCompletedDate, "2026-07-23");

  const legacyV2 = {
    version: 2,
    ponds: [{
      id: "legacy-pond", unitType: "pond", name: "旧塘", species: "罗非鱼",
      location: "广东", areaMu: 5, status: "active", stockingDate: "2026-07-01",
      stockingQuantity: 1000, alertProfileId: "tilapia", needsStockingDate: false,
      createdAt: now, updatedAt: now
    }],
    records: [{
      id: "legacy-feed", pondId: "legacy-pond", type: "feed", date: "2026-07-23",
      note: "", weightKg: 10, unitPriceYuan: 8, createdAt: now, updatedAt: now
    }],
    settings: { selectedPondId: "legacy-pond", homeView: "field", accentMode: "auto", customProfileThresholds: {} },
    syncMeta: {
      protocolVersion: 3, serverRevision: 0, lastSyncedAt: "", deviceId: "",
      status: "local", message: "本机数据", deletedPondIds: [], deletedRecordIds: []
    },
    migrationMeta: { sourceVersion: 2, migratedAt: now, needsPondCompletion: false }
  };
  const migrated = migrateV2ToV4(legacyV2, now, "owner-a");
  assert.equal(migrated.farms.length, 1);
  assert.equal(migrated.units.length, 1);
  assert.equal(migrated.batches.length, 1);
  assert.equal(migrated.records[0].batchId, migrated.batches[0].id);
  assert.equal(migrated.records[0].data.weightKg, 10);

  const encrypted = createEncryptedBackup(state, "test-password");
  assert.doesNotMatch(encrypted, /海丰养殖场/);
  assert.deepEqual(parseEncryptedBackup(encrypted, "test-password"), state);
  assert.throws(() => parseEncryptedBackup(encrypted, "wrong-password"), /密码|备份/);

  const completeBackup = createCompleteBackupPackage(state);
  assert.match(completeBackup.files.recordsCsv, /batchId/);
  assert.equal(completeBackup.files.reports.length, 3);
  assert.deepEqual(parseEncryptedBackup(createCompleteEncryptedBackup(state, "test-password"), "test-password"), state);

  const conflicted = {
    ...state,
    syncMeta: {
      ...state.syncMeta,
      status: "conflict",
      conflicts: [{ id: "record-conflict", entityType: "record", entityId: state.records[0].id, field: "*", localValue: state.records[0], remoteValue: { ...state.records[0], note: "云端版本" } }]
    }
  };
  assert.equal(resolveV4Conflict(conflicted, "record-conflict", "remote").records[0].note, "云端版本");

  const finished = finishBatch(state, batch.id, "owner-a", now);
  assert.equal(finished.batches.find((item) => item.id === batch.id).status, "completed");
  const removed = deleteUnitPermanent(state, unit.id, "owner-a", now);
  assert.equal(removed.units.some((item) => item.id === unit.id), false);
  assert.equal(removed.records.some((item) => item.unitId === unit.id), false);

  console.log("0.4 domain checks passed");
} finally {
  rmSync(temp, { recursive: true, force: true });
}
