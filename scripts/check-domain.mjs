import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { mkdir, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const records = [
  { type: "feed", weightKg: 120, unitPriceYuan: 8.5, date: "2026-06-11" },
  { type: "harvest", weightKg: 460, unitPriceYuan: 22, date: "2026-06-09" }
];

const revenue = records
  .filter((item) => item.type === "harvest")
  .reduce((sum, item) => sum + item.weightKg * item.unitPriceYuan, 0);
const feedCost = records
  .filter((item) => item.type === "feed")
  .reduce((sum, item) => sum + item.weightKg * item.unitPriceYuan, 0);

assert.equal(revenue, 10120);
assert.equal(feedCost, 1020);
assert.equal(revenue - feedCost, 9100);

const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, "..");
const tempRoot = await mkdtemp(join(tmpdir(), "fishery-domain-check-"));
const outDir = join(tempRoot, "compiled");

function compileDomainModules() {
  const localTsc = join(projectRoot, "node_modules", "typescript", "bin", "tsc");
  const command = existsSync(localTsc) ? process.execPath : "tsc";
  const tscArgs = existsSync(localTsc) ? [localTsc] : [];
  execFileSync(
    command,
    [
      ...tscArgs,
      "--target",
      "ES2019",
      "--module",
      "commonjs",
      "--moduleResolution",
      "node",
      "--strict",
      "--skipLibCheck",
      "--esModuleInterop",
      "--rootDir",
      "src",
      "--outDir",
      outDir,
      "src/config/api.ts",
      "src/types/index.ts",
      "src/domain/export.ts",
      "src/domain/id.ts",
      "src/domain/pond-health.ts",
      "src/domain/state-validation.ts",
      "src/domain/sync-payload.ts",
      "src/domain/sync-state.ts",
      "src/domain/validation.ts",
      "src/domain/weekly-report.ts"
    ],
    { cwd: projectRoot, stdio: "inherit" }
  );
}

function backupPayload(state) {
  return JSON.stringify({
    exportedAt: "2026-07-04T00:00:00.000Z",
    app: "fishery-manager",
    formatVersion: 1,
    state
  });
}

const validPond = {
  id: "pond-1",
  name: "1号塘",
  species: "罗非鱼",
  location: "广东湛江",
  areaMu: 8.5,
  day: 42,
  status: "active",
  createdAt: "2026-06-11T00:00:00.000Z",
  updatedAt: "2026-06-11T00:00:00.000Z"
};

const validWaterRecord = {
  id: "record-water-1",
  pondId: "pond-1",
  type: "water",
  date: "2026-06-11",
  ph: 8.2,
  dissolvedOxygen: 4.6,
  ammoniaNitrogen: 0.2,
  note: "复测正常",
  createdAt: "2026-06-11T00:00:00.000Z"
};

await mkdir(outDir, { recursive: true });

try {
  compileDomainModules();
  const require = createRequire(import.meta.url);
  const apiConfigPath = join(outDir, "config", "api.js");
  const apiConfigCacheKey = require.resolve(apiConfigPath);
  function loadApiConfig() {
    delete require.cache[apiConfigCacheKey];
    return require(apiConfigPath);
  }
  const { parseJsonBackup } = require(join(outDir, "domain", "export.js"));
  const { createId } = require(join(outDir, "domain", "id.js"));
  const { evaluatePondHealth } = require(join(outDir, "domain", "pond-health.js"));
  const { createSyncPushPayload } = require(join(outDir, "domain", "sync-payload.js"));
  const { createLocalStateFromPullResult } = require(join(outDir, "domain", "sync-state.js"));
  const { parseRequiredNumber, validateNumberRange } = require(join(outDir, "domain", "validation.js"));
  const { buildWeeklyReport } = require(join(outDir, "domain", "weekly-report.js"));

  assert.equal(loadApiConfig().getAccountSyncMode(), "disabled", "sync mode should be disabled without cloudbase or https config");
  process.env.TARO_APP_API_BASE_URL = "https://api.example.com";
  assert.equal(loadApiConfig().getAccountSyncMode(), "http", "https API config should enable http sync fallback");
  process.env.TARO_APP_CLOUDBASE_ENV_ID = "cloudbase-env-id";
  assert.equal(loadApiConfig().getAccountSyncMode(), "cloudbase", "cloudbase config should take priority over http sync");
  delete process.env.TARO_APP_API_BASE_URL;
  delete process.env.TARO_APP_CLOUDBASE_ENV_ID;

  const ids = Array.from({ length: 50 }, () => createId("pond"));
  assert.equal(new Set(ids).size, ids.length, "createId should avoid collisions during burst creation");
  assert.match(ids[0], /^pond-\d+-[a-z0-9]+$/, "createId should include the prefix, timestamp, and random suffix");

  assert.equal(parseRequiredNumber("", "pH").valid, false, "numeric validation should reject empty fields");
  assert.equal(parseRequiredNumber("  ", "重量").valid, false, "numeric validation should reject whitespace-only fields");
  assert.equal(parseRequiredNumber("3.5", "溶氧").value, 3.5, "numeric validation should parse valid numeric text");
  assert.equal(validateNumberRange(18, "pH", 0, 14).valid, false, "numeric range validation should reject pH above 14");

  assert.equal(parseJsonBackup(backupPayload({ version: 1, ponds: [validPond], records: [validWaterRecord] })).valid, true);

  assert.equal(
    parseJsonBackup(backupPayload({ version: 1, ponds: [{ ...validPond, name: "" }], records: [] })).valid,
    false,
    "backup import should reject invalid pond shape"
  );

  assert.equal(
    parseJsonBackup(backupPayload({ version: 1, ponds: [validPond], records: [{ ...validWaterRecord, pondId: "missing-pond" }] }))
      .valid,
    false,
    "backup import should reject records referencing a missing pond"
  );

  assert.equal(
    parseJsonBackup(backupPayload({ version: 1, ponds: [validPond], records: [{ ...validWaterRecord, ph: 18 }] })).valid,
    false,
    "backup import should reject water pH outside 0-14"
  );

  assert.equal(
    parseJsonBackup(backupPayload({ version: 1, ponds: [validPond], records: [{ ...validWaterRecord, date: "2026-99-99" }] }))
      .valid,
    false,
    "backup import should reject invalid record dates"
  );

  const healthState = {
    version: 1,
    ponds: [
      {
        id: "pond-health-1",
        name: "Pond A",
        species: "Tilapia",
        location: "Zhanjiang",
        areaMu: 8.5,
        day: 42,
        status: "active",
        createdAt: "2026-07-01T00:00:00.000Z",
        updatedAt: "2026-07-01T00:00:00.000Z"
      }
    ],
    records: [
      {
        id: "record-water-low-oxygen",
        pondId: "pond-health-1",
        type: "water",
        date: "2026-07-04",
        ph: 7.2,
        dissolvedOxygen: 2.8,
        ammoniaNitrogen: 0.1,
        note: "",
        createdAt: "2026-07-04T08:00:00.000Z"
      },
      {
        id: "record-feed-old",
        pondId: "pond-health-1",
        type: "feed",
        date: "2026-07-01",
        weightKg: 12,
        unitPriceYuan: 8,
        note: "",
        createdAt: "2026-07-01T08:00:00.000Z"
      }
    ]
  };

  const health = evaluatePondHealth(healthState, "pond-health-1", "2026-07-04");
  assert.deepEqual(
    health.alerts.map((alert) => alert.code),
    ["LOW_OXYGEN", "MISSING_FEED_RECORD"],
    "pond health should flag low dissolved oxygen and missing recent feed records"
  );
  assert.equal(health.alerts[0].severity, "high");

  const weeklyReport = buildWeeklyReport(healthState, "pond-health-1", "2026-07-04");
  assert.equal(weeklyReport.feedWeightKg, 12, "weekly report should sum feed weight");
  assert.equal(weeklyReport.waterRecordCount, 1, "weekly report should count water records");
  assert.equal(weeklyReport.harvestWeightKg, 0, "weekly report should default harvest weight to zero");
  assert.equal(weeklyReport.alertCount, 2, "weekly report should include current alert count");

  const localOwnerState = {
    ...healthState,
    owner: {
      mode: "local",
      localOwnerId: "local-device-1",
      boundUserId: ""
    }
  };
  assert.equal(localOwnerState.owner.mode, "local");
  assert.equal(parseJsonBackup(backupPayload(healthState)).valid, true, "existing backups remain compatible");

  const syncPayload = createSyncPushPayload(
    {
      version: 1,
      ponds: [{ ...validPond, ownerUserId: "usr_other" }],
      records: [{ ...validWaterRecord, ownerUserId: "usr_other" }]
    },
    "device-1",
    "2026-07-04T00:00:00.000Z"
  );
  assert.equal(syncPayload.deviceId, "device-1");
  assert.equal(syncPayload.lastSyncedAt, "2026-07-04T00:00:00.000Z");
  assert.equal("ownerUserId" in syncPayload.ponds[0], false, "mini program sync payload must not trust pond ownerUserId");
  assert.equal("ownerUserId" in syncPayload.records[0], false, "mini program sync payload must not trust record ownerUserId");

  const pulledState = createLocalStateFromPullResult({
    serverRevision: 2,
    ponds: [{ ...validPond, ownerUserId: "usr_server" }],
    records: [{ ...validWaterRecord, ownerUserId: "usr_server" }]
  });
  assert.equal(pulledState.version, 1, "pulled cloud data should remain compatible with local FarmState v1");
  assert.equal("ownerUserId" in pulledState.ponds[0], false, "local state must not persist server pond ownerUserId");
  assert.equal("ownerUserId" in pulledState.records[0], false, "local state must not persist server record ownerUserId");
} finally {
  rmSync(tempRoot, { recursive: true, force: true });
}

console.log("domain checks passed");
