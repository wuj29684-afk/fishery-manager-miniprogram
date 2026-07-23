import { inferAlertProfile } from "./alert-profiles";
import { addDaysToDate } from "./withdrawal";
import type { FarmRecord, FarmState, Pond } from "../types";

type UnknownObject = Record<string, unknown>;

function isObject(value: unknown): value is UnknownObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function createEmptyFarmState(now = new Date().toISOString(), deviceId = ""): FarmState {
  return {
    version: 2,
    ponds: [],
    records: [],
    settings: { selectedPondId: "", homeView: "field", accentMode: "auto", customProfileThresholds: {} },
    syncMeta: {
      protocolVersion: 3,
      serverRevision: 0,
      lastSyncedAt: "",
      deviceId,
      status: "local",
      message: "本机数据",
      deletedPondIds: [],
      deletedRecordIds: []
    },
    migrationMeta: { sourceVersion: 2, migratedAt: now, needsPondCompletion: false }
  };
}

function migratePond(value: UnknownObject): Pond {
  const stockingDate = typeof value.stockingDate === "string" ? value.stockingDate : undefined;
  const legacyDay = typeof value.day === "number" ? value.day : undefined;
  return {
    id: String(value.id || ""),
    unitType: value.unitType === "cage" ? "cage" : "pond",
    name: String(value.name || ""),
    species: String(value.species || ""),
    location: String(value.location || ""),
    areaMu: Number(value.areaMu || 0),
    cageLengthM: typeof value.cageLengthM === "number" ? value.cageLengthM : undefined,
    cageWidthM: typeof value.cageWidthM === "number" ? value.cageWidthM : undefined,
    cageDepthM: typeof value.cageDepthM === "number" ? value.cageDepthM : undefined,
    cageSpecification: typeof value.cageSpecification === "string" ? value.cageSpecification : undefined,
    status: value.status === "inactive" ? "inactive" : "active",
    stockingDate,
    stockingQuantity: typeof value.stockingQuantity === "number" ? value.stockingQuantity : undefined,
    initialSize: typeof value.initialSize === "string" ? value.initialSize : undefined,
    cultureStage: typeof value.cultureStage === "string" ? value.cultureStage : undefined,
    alertProfileId:
      value.alertProfileId === "shrimp" || value.alertProfileId === "tilapia" || value.alertProfileId === "general"
        ? value.alertProfileId
        : inferAlertProfile(String(value.species || ""), value.unitType === "cage" ? "cage" : "pond"),
    customThresholds: isObject(value.customThresholds) ? value.customThresholds : undefined,
    targetHarvestDate: typeof value.targetHarvestDate === "string" ? value.targetHarvestDate : undefined,
    legacyStockingDays: typeof value.legacyStockingDays === "number" ? value.legacyStockingDays : legacyDay,
    needsStockingDate: typeof value.needsStockingDate === "boolean" ? value.needsStockingDate : !stockingDate,
    createdAt: String(value.createdAt || new Date().toISOString()),
    updatedAt: String(value.updatedAt || value.createdAt || new Date().toISOString())
  } as Pond;
}

function migrateRecord(value: UnknownObject): FarmRecord {
  const date = String(value.date || "");
  const migrated = {
    ...value,
    id: String(value.id || ""),
    pondId: String(value.pondId || ""),
    date,
    note: typeof value.note === "string" ? value.note : "",
    createdAt: String(value.createdAt || new Date().toISOString()),
    updatedAt: String(value.updatedAt || value.createdAt || new Date().toISOString())
  } as unknown as FarmRecord;
  if (migrated.type === "drug" && !migrated.withdrawalEndDate) {
    migrated.withdrawalEndDate = addDaysToDate(date, migrated.withdrawalDays);
  }
  return migrated;
}

export function migrateFarmState(value: unknown, now = new Date().toISOString()): FarmState {
  if (!isObject(value) || !Array.isArray(value.ponds) || !Array.isArray(value.records)) {
    throw new Error("经营数据格式不正确");
  }
  if (!value.ponds.every(isObject) || !value.records.every(isObject)) {
    throw new Error("经营数据包含无法识别的塘口或记录");
  }
  const sourceVersion = value.version === 2 ? 2 : 1;
  const ponds = value.ponds.map(migratePond);
  const records = value.records.map(migrateRecord);
  const base = createEmptyFarmState(now);
  const settings = isObject(value.settings) ? value.settings : {};
  const syncMeta = isObject(value.syncMeta) ? value.syncMeta : {};
  return {
    ...base,
    ponds,
    records,
    settings: {
      selectedPondId: typeof settings.selectedPondId === "string" ? settings.selectedPondId : ponds[0]?.id || "",
      homeView: settings.homeView === "overview" ? "overview" : "field",
      accentMode: settings.accentMode === "land" || settings.accentMode === "ocean" ? settings.accentMode : "auto",
      customProfileThresholds: isObject(settings.customProfileThresholds) ? settings.customProfileThresholds : {}
    },
    syncMeta: {
      ...base.syncMeta,
      ...syncMeta,
      protocolVersion: 3,
      serverRevision: Number(syncMeta.serverRevision || 0),
      deletedPondIds: Array.isArray(syncMeta.deletedPondIds) ? syncMeta.deletedPondIds.map(String) : [],
      deletedRecordIds: Array.isArray(syncMeta.deletedRecordIds) ? syncMeta.deletedRecordIds.map(String) : []
    },
    migrationMeta: {
      sourceVersion,
      migratedAt: sourceVersion === 1 ? now : String((isObject(value.migrationMeta) && value.migrationMeta.migratedAt) || now),
      needsPondCompletion: ponds.some((pond) => pond.needsStockingDate)
    }
  };
}
