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
    "src/types/index.ts", "src/domain/alert-profiles.ts", "src/domain/farm-state.ts", "src/domain/withdrawal.ts",
    "src/domain/state-validation.ts", "src/domain/sync-payload.ts", "src/domain/sync-state.ts", "src/domain/pond-health.ts",
    "src/domain/operations.ts", "src/domain/weekly-report.ts", "src/domain/export.ts", "src/domain/validation.ts"
  ], { cwd: root, stdio: "inherit" });
  const require = createRequire(import.meta.url);
  const { createEmptyFarmState, migrateFarmState } = require(join(out, "domain", "farm-state.js"));
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
  console.log("domain v2 checks passed");
} finally { rmSync(temp, { recursive: true, force: true }); }
