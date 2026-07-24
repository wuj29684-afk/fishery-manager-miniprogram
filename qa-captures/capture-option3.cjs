const automator = require("C:/Temp/codex-miniprogram-automator/node_modules/miniprogram-automator");
const path = require("path");

const outputDir = __dirname;
const storageKey = "fishery-manager:state:v3";
const legacyKey = "fishery-manager:farm-state:v1";
const now = "2026-07-24T08:30:00.000Z";
const today = "2026-07-24";

const units = [
  ["unit-cage-1", "cage", "1号南美白对虾池", "青岛海域", 268500],
  ["unit-cage-2", "cage", "2号南美白对虾池", "青岛海域", 180000],
  ["unit-cage-3", "cage", "3号海鲈网箱", "海湾北区", 12000],
  ["unit-pond-1", "pond", "4号草鱼塘", "陆地区", 86000],
  ["unit-pond-2", "pond", "5号罗非鱼塘", "陆地区", 72000],
  ["unit-tank-1", "tank", "8号工厂化循环池", "室内区", 30000],
  ["unit-other-1", "other", "9号稻渔流水区", "生态区", 18000]
].map(([id, type, name, location]) => ({
  id, farmId: "farm-qa", type, name, location, areaMu: type === "pond" ? 6 : undefined,
  status: "active", createdAt: now, updatedAt: now
}));

const batches = units.map((unit, index) => ({
  id: `batch-${unit.id}`,
  farmId: "farm-qa",
  unitId: unit.id,
  species: index < 2 ? "南美白对虾" : index === 2 ? "海鲈鱼" : index === 3 ? "草鱼" : index === 4 ? "罗非鱼" : "鲈鱼",
  status: "culturing",
  stockingDate: index === 0 ? "2026-05-17" : "2026-06-01",
  stockingQuantity: Number(["268500", "180000", "12000", "86000", "72000", "30000", "18000"][index]),
  initialAverageWeightG: 0.03,
  createdAt: now,
  updatedAt: now
}));

const records = [
  ["record-feed-1", "feed", { weightKg: 120, unitCostYuan: 8.6, recordTime: "08:30" }, "投喂配合饲料，摄食正常"],
  ["record-water-1", "water", { temperatureC: 28.6, dissolvedOxygenMgL: 5.2, ph: 7.8, recordTime: "07:30" }, "晨间水质检测"],
  ["record-patrol-1", "patrol", { abnormal: true, severity: "warning", recordTime: "10:00" }, "水体出现轻微异常"],
  ["record-drug-1", "drug", { amount: 5, costYuan: 120, recordTime: "19:00" }, "维生素C"],
  ["record-water-2", "water", { temperatureC: 28.1, dissolvedOxygenMgL: 4.8, ph: 7.6, recordTime: "18:40" }, "晚间复测"]
].map(([id, type, data, note], index) => ({
  id,
  farmId: "farm-qa",
  unitId: "unit-cage-1",
  batchId: "batch-unit-cage-1",
  type,
  date: index < 3 ? today : "2026-07-23",
  note,
  data,
  photos: [],
  createdBy: "local-user",
  updatedBy: "local-user",
  createdAt: `2026-07-${index < 3 ? "24" : "23"}T${String(8 + index).padStart(2, "0")}:30:00.000Z`,
  updatedAt: now
}));

const baseState = {
  version: 3,
  auth: { status: "guest", userId: "local-user", displayName: "" },
  farms: [{ id: "farm-qa", name: "我的养殖场", ownerUserId: "local-user", province: "山东省", city: "青岛市", district: "即墨区", status: "active", createdAt: now, updatedAt: now }],
  members: [{ id: "member-owner", farmId: "farm-qa", userId: "local-user", displayName: "塘主", role: "owner", unitIds: [], canViewFinance: true, status: "active", createdAt: now, updatedAt: now }],
  units,
  batches,
  records,
  inventory: [],
  inventoryMovements: [],
  tasks: [],
  templates: [],
  deletionAudit: [],
  telemetry: [],
  settings: { selectedFarmId: "farm-qa", selectedUnitId: "unit-cage-1", weightUnit: "kg", quickRecordTypes: ["feed", "water", "patrol", "mortality"], homeMode: "record", telemetryEnabled: true, autoSyncEnabled: true },
  syncMeta: { protocolVersion: 4, baseRevision: 0, pendingEntityIds: ["record-feed-1"], conflicts: [], status: "pending", lastSyncedAt: "", message: "有数据待同步" },
  migration: { sourceVersion: 3, migratedAt: now, legacyBackupCreated: false }
};

async function pause(ms = 650) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function save(miniProgram, state) {
  await miniProgram.callWxMethod("setStorageSync", storageKey, state);
}

async function capture(miniProgram, route, file) {
  console.log(`capturing ${route}`);
  await miniProgram.reLaunch(route);
  console.log(`opened ${route}`);
  await pause();
  await miniProgram.pageScrollTo(0);
  await pause(300);
  await miniProgram.screenshot({ path: path.join(outputDir, file) });
  console.log(`saved ${file}`);
}

(async () => {
  const miniProgram = await automator.connect({ wsEndpoint: "ws://127.0.0.1:9430" });
  try {
    if (process.argv.includes("--unit-images")) {
      await save(miniProgram, baseState);
      await miniProgram.reLaunch("/pages/units/index");
      await pause();
      await miniProgram.pageScrollTo(620);
      await pause(300);
      await miniProgram.screenshot({ path: path.join(outputDir, "option3-unit-images-list.png") });
      await capture(miniProgram, "/pages/pond-detail/index?id=unit-pond-1", "option3-unit-image-pond.png");
      await capture(miniProgram, "/pages/pond-detail/index?id=unit-tank-1", "option3-unit-image-tank.png");
      await capture(miniProgram, "/pages/pond-detail/index?id=unit-other-1", "option3-unit-image-other.png");
      return;
    }
    const lastOnly = process.argv.includes("--last-only");
    if (lastOnly) {
      await save(miniProgram, baseState);
      await capture(miniProgram, "/pages/profile/index", "option3-11-profile.png");
      await capture(miniProgram, "/pages/data-backup/index", "option3-12-sync.png");
      return;
    }
    if (process.argv.includes("--focus")) {
      await save(miniProgram, { ...baseState, settings: { ...baseState.settings, homeMode: "overview" } });
      await capture(miniProgram, "/pages/index/index", "option3-03-home-overview.png");
      await save(miniProgram, baseState);
      await capture(miniProgram, "/pages/pond-form/index", "option3-05-create-unit.png");
      return;
    }
    await miniProgram.callWxMethod("removeStorageSync", storageKey);
    await miniProgram.callWxMethod("removeStorageSync", legacyKey);
    await capture(miniProgram, "/pages/index/index", "option3-01-empty-home.png");

    await save(miniProgram, baseState);
    await capture(miniProgram, "/pages/index/index", "option3-02-home-duty.png");

    await save(miniProgram, { ...baseState, settings: { ...baseState.settings, homeMode: "overview" } });
    await capture(miniProgram, "/pages/index/index", "option3-03-home-overview.png");

    await save(miniProgram, baseState);
    await capture(miniProgram, "/pages/units/index", "option3-04-units.png");
    await capture(miniProgram, "/pages/pond-form/index", "option3-05-create-unit.png");
    await capture(miniProgram, "/pages/pond-detail/index?id=unit-cage-1", "option3-06-unit-detail.png");
    await capture(miniProgram, "/pages/record-form/index", "option3-07-quick.png");
    await capture(miniProgram, "/pages/record-form/index?unitId=unit-cage-1&type=feed", "option3-08-feed-form.png");
    await capture(miniProgram, "/pages/record-form/index?unitId=unit-cage-1&type=water", "option3-09-water-form.png");
    await capture(miniProgram, "/pages/records/index", "option3-10-records.png");
    await capture(miniProgram, "/pages/profile/index", "option3-11-profile.png");
    await capture(miniProgram, "/pages/data-backup/index", "option3-12-sync.png");
  } finally {
    miniProgram.disconnect();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
