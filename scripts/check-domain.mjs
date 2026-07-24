import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const temp = await mkdtemp(join(tmpdir(), "fishery-v2-"));
const out = join(temp, "compiled");
await mkdir(out, { recursive: true });
try {
  const localTsc = join(root, "node_modules", "typescript", "bin", "tsc");
  execFileSync(existsSync(localTsc) ? process.execPath : "tsc", [
    ...(existsSync(localTsc) ? [localTsc] : []), "--target", "ES2019", "--module", "commonjs", "--moduleResolution", "node",
    "--strict", "--skipLibCheck", "--esModuleInterop", "--rootDir", "src", "--outDir", out,
    "src/types/index.ts", "src/domain/alert-profiles.ts", "src/domain/farm-state.ts", "src/domain/farm-state-v3.ts",
    "src/domain/farm-state-v3-preview.ts", "src/domain/withdrawal.ts",
    "src/domain/state-validation.ts", "src/domain/sync-payload.ts", "src/domain/sync-state.ts", "src/domain/pond-health.ts",
    "src/domain/operations.ts", "src/domain/weekly-report.ts", "src/domain/export.ts", "src/domain/validation.ts"
  ], { cwd: root, stdio: "inherit" });
  const require = createRequire(import.meta.url);
  const { createEmptyFarmState, migrateFarmState } = require(join(out, "domain", "farm-state.js"));
  const { migrateFarmStateToV3 } = require(join(out, "domain", "farm-state-v3.js"));
  const {
    FARM_STATE_V3_PREVIEW_KEY,
    createFarmStateV3Preview,
    createFarmStateV3PreviewRepository,
    inspectFarmStateV3Storage
  } = require(join(out, "domain", "farm-state-v3-preview.js"));
  const { validateFarmState } = require(join(out, "domain", "state-validation.js"));
  const { addDaysToDate, hasActiveWithdrawal } = require(join(out, "domain", "withdrawal.js"));
  const { calculateFcr, calculateEstimatedProfit } = require(join(out, "domain", "operations.js"));
  const { evaluatePondHealth } = require(join(out, "domain", "pond-health.js"));
  const empty = createEmptyFarmState("2026-07-11T00:00:00.000Z");
  assert.equal(empty.version, 2); assert.deepEqual(empty.ponds, []); assert.deepEqual(empty.records, []);
  const v1 = { version: 1, ponds: [{ id: "p", name: "塘", species: "罗非鱼", location: "广东", areaMu: 5, day: 20, status: "active", createdAt: "2026-07-01T00:00:00.000Z", updatedAt: "2026-07-01T00:00:00.000Z" }], records: [] };
  const migrated = migrateFarmState(v1, "2026-07-11T00:00:00.000Z");
  assert.equal(migrated.ponds[0].legacyStockingDays, 20); assert.equal(migrated.ponds[0].needsStockingDate, true);
  assert.equal(validateFarmState(migrated).valid, true);
  const legacyRecord = {
    id: "legacy-feed",
    pondId: "p",
    type: "feed",
    date: "2026-07-11",
    note: "旧版投喂",
    createdAt: "2026-07-11T00:00:00.000Z",
    updatedAt: "2026-07-11T00:00:00.000Z",
    weightKg: 18,
    unitPriceYuan: 8.6
  };
  const migratedV3 = migrateFarmStateToV3(
    { ...migrated, records: [legacyRecord] },
    "2026-07-23T00:00:00.000Z"
  );
  assert.equal(migratedV3.version, 3);
  assert.equal(migratedV3.farms.length, 1);
  assert.equal(migratedV3.farms[0].name, "我的养殖场");
  assert.equal(migratedV3.ponds[0].farmId, migratedV3.farms[0].id);
  assert.equal(migratedV3.batches.length, 1);
  assert.equal(migratedV3.batches[0].pondId, "p");
  assert.equal(migratedV3.records[0].batchId, migratedV3.batches[0].id);
  assert.equal(migratedV3.records[0].weightKg, 18);
  assert.deepEqual(
    migrateFarmStateToV3(migratedV3, "2026-07-24T00:00:00.000Z"),
    migratedV3
  );
  const emptyV3 = migrateFarmStateToV3(empty, "2026-07-23T00:00:00.000Z");
  assert.equal(emptyV3.farms.length, 1);
  assert.equal(emptyV3.ponds.length, 0);
  assert.equal(emptyV3.batches.length, 0);
  assert.equal(emptyV3.records.length, 0);
  assert.equal(emptyV3.settings.selectedFarmId, emptyV3.farms[0].id);
  const secondPond = {
    ...migrated.ponds[0],
    id: "p-2",
    name: "二号塘",
    createdAt: "2026-07-02T00:00:00.000Z",
    updatedAt: "2026-07-02T00:00:00.000Z"
  };
  const secondRecord = { ...legacyRecord, id: "legacy-feed-2", pondId: "p-2" };
  const multipleV3 = migrateFarmStateToV3(
    { ...migrated, ponds: [...migrated.ponds, secondPond], records: [legacyRecord, secondRecord] },
    "2026-07-23T00:00:00.000Z"
  );
  assert.equal(multipleV3.batches.length, 2);
  assert.equal(new Set(multipleV3.batches.map((batch) => batch.id)).size, 2);
  assert.equal(
    multipleV3.records.find((record) => record.id === "legacy-feed-2").batchId,
    multipleV3.batches.find((batch) => batch.pondId === "p-2").id
  );
  assert.throws(
    () => migrateFarmStateToV3(
      { ...migratedV3, ponds: [{ ...migratedV3.ponds[0], farmId: "missing-farm" }] },
      "2026-07-23T00:00:00.000Z"
    ),
    /养殖场不存在/
  );
  assert.throws(
    () => migrateFarmStateToV3(
      { ...migratedV3, records: [{ ...migratedV3.records[0], batchId: "missing-batch" }] },
      "2026-07-23T00:00:00.000Z"
    ),
    /养殖场、养殖单元或养殖批次不存在/
  );
  const legacySource = { ...migrated, records: [legacyRecord] };
  const legacySnapshot = structuredClone(legacySource);
  const preview = createFarmStateV3Preview(legacySource, "2026-07-23T00:00:00.000Z");
  assert.deepEqual(legacySource, legacySnapshot);
  assert.equal(preview.summary.sourceVersion, 2);
  assert.equal(preview.summary.farmCount, 1);
  assert.equal(preview.summary.unitCount, 1);
  assert.equal(preview.summary.batchCount, 1);
  assert.equal(preview.summary.recordCount, 1);
  assert.deepEqual(preview.summary.warnings, ["1 个养殖单元缺少投苗日期"]);
  assert.deepEqual(preview.state, migratedV3);
  const previewStorage = new Map([["fishery-manager:farm-state:v1", legacySnapshot]]);
  const previewRepository = createFarmStateV3PreviewRepository({
    get: (key) => previewStorage.get(key),
    set: (key, value) => previewStorage.set(key, value),
    remove: (key) => previewStorage.delete(key)
  });
  assert.deepEqual(
    previewRepository.save(legacySource, "2026-07-23T00:00:00.000Z"),
    preview
  );
  assert.deepEqual(previewRepository.load(), preview);
  assert.deepEqual(previewStorage.get("fishery-manager:farm-state:v1"), legacySnapshot);
  assert.equal(previewStorage.has(FARM_STATE_V3_PREVIEW_KEY), true);
  previewRepository.clear();
  assert.equal(previewStorage.has(FARM_STATE_V3_PREVIEW_KEY), false);
  assert.deepEqual(previewStorage.get("fishery-manager:farm-state:v1"), legacySnapshot);
  const inspectedPreview = inspectFarmStateV3Storage(
    {
      get: (key) => previewStorage.get(key),
      set: (key, value) => previewStorage.set(key, value),
      remove: (key) => previewStorage.delete(key)
    },
    "fishery-manager:farm-state:v1",
    "2026-07-23T00:00:00.000Z"
  );
  assert.equal(inspectedPreview.summary.sourceVersion, 2);
  assert.equal(inspectedPreview.summary.unitCount, 1);
  assert.deepEqual(previewStorage.get("fishery-manager:farm-state:v1"), legacySnapshot);
  assert.deepEqual(previewStorage.get(FARM_STATE_V3_PREVIEW_KEY), inspectedPreview);
  const emptyPreviewStorage = new Map();
  const emptyInspection = inspectFarmStateV3Storage(
    {
      get: (key) => emptyPreviewStorage.get(key),
      set: (key, value) => emptyPreviewStorage.set(key, value),
      remove: (key) => emptyPreviewStorage.delete(key)
    },
    "fishery-manager:farm-state:v1",
    "2026-07-23T00:00:00.000Z"
  );
  assert.equal(emptyInspection.summary.unitCount, 0);
  assert.equal(emptyInspection.summary.recordCount, 0);
  assert.equal(emptyPreviewStorage.has("fishery-manager:farm-state:v1"), false);
  assert.throws(
    () => migrateFarmState({ ...v1, ponds: [...v1.ponds, null] }, "2026-07-11T00:00:00.000Z"),
    /无法识别/
  );
  assert.throws(
    () => migrateFarmState({ ...v1, records: ["invalid"] }, "2026-07-11T00:00:00.000Z"),
    /无法识别/
  );
  assert.equal(addDaysToDate("2026-12-29", 7), "2027-01-05");
  assert.equal(hasActiveWithdrawal([{ type: "drug", date: "2026-07-01", withdrawalDays: 7 }], "2026-07-08"), true);
  const pond = { ...migrated.ponds[0], stockingDate: "2026-07-01", stockingQuantity: 1000, initialSize: "1", needsStockingDate: false };
  const now = "2026-07-11T00:00:00.000Z";
  const records = [
    { id: "f", pondId: "p", type: "feed", date: "2026-07-11", note: "", createdAt: now, updatedAt: now, weightKg: 100, unitPriceYuan: 8 },
    { id: "s", pondId: "p", type: "sampling", date: "2026-07-11", note: "", createdAt: now, updatedAt: now, sampleCount: 30, averageWeightG: 101, estimatedStockQuantity: 1000 },
    { id: "e", pondId: "p", type: "expense", date: "2026-07-11", note: "", createdAt: now, updatedAt: now, category: "electricity", itemName: "电费", amountYuan: 200 }
  ];
  assert.equal(calculateFcr(pond, records), 1);
  assert.equal(calculateEstimatedProfit(records), -1000);
  const healthState = { ...empty, ponds: [pond], records: [{ id: "w", pondId: "p", type: "water", date: "2026-07-11", note: "", createdAt: now, updatedAt: now, ph: 7.2, dissolvedOxygen: 2, ammoniaNitrogen: 0.1 }] };
  assert.equal(evaluatePondHealth(healthState, "p", "2026-07-11").alerts[0].code, "LOW_OXYGEN");
  console.log("domain v2/v3 checks passed");
} finally { rmSync(temp, { recursive: true, force: true }); }
