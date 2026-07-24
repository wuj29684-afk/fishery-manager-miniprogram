import Taro from "@tarojs/taro";
import { createEmptyFarmState, migrateFarmState } from "../domain/farm-state";
import { createId } from "../domain/id";
import { validateFarmState } from "../domain/state-validation";
import { addDaysToDate } from "../domain/withdrawal";
import type { AccentMode, FarmRecord, FarmRecordInput, FarmState, HomeView, Pond } from "../types";

export const FARM_STATE_STORAGE_KEY = "fishery-manager:farm-state:v1";
const STORAGE_KEY = FARM_STATE_STORAGE_KEY;
const MIGRATION_BACKUP_KEY = "fishery-manager:farm-state:v1:migration-backup";
const RECOVERY_KEY = "fishery-manager:farm-state:v2:recovery";
const DATA_EPOCH_KEY = "fishery-manager:data-epoch:v1";
const CURRENT_DATA_EPOCH = "3";
const DEMO_POND_IDS = ["pond-1", "pond-2"];
const DEMO_RECORD_IDS = ["record-feed-1", "record-water-1", "record-drug-1", "record-harvest-1"];
const EXPERIENCE_POND_ID = "experience-pond-shrimp";

export class FarmDataError extends Error {}

export async function loadFarmState(): Promise<FarmState> {
  const savedEpoch = Taro.getStorageSync<string>(DATA_EPOCH_KEY);
  if (savedEpoch !== CURRENT_DATA_EPOCH) {
    const empty = createEmptyFarmState();
    Taro.setStorageSync(STORAGE_KEY, empty);
    Taro.removeStorageSync(MIGRATION_BACKUP_KEY);
    Taro.removeStorageSync(RECOVERY_KEY);
    Taro.setStorageSync(DATA_EPOCH_KEY, CURRENT_DATA_EPOCH);
    return empty;
  }
  let stored: unknown;
  try {
    stored = Taro.getStorageSync<unknown>(STORAGE_KEY);
  } catch {
    throw new FarmDataError("本机经营数据读取失败，请稍后重试或从备份恢复");
  }
  if (!stored) {
    const empty = createEmptyFarmState();
    Taro.setStorageSync(STORAGE_KEY, empty);
    return empty;
  }
  const validation = validateFarmState(stored);
  if (!validation.valid || !validation.state) {
    throw new FarmDataError(validation.message || "本机经营数据异常，已停止覆盖写入");
  }
  if ((stored as { version?: number }).version !== 2) {
    Taro.setStorageSync(MIGRATION_BACKUP_KEY, stored);
    Taro.setStorageSync(STORAGE_KEY, validation.state);
  }
  const withoutDemo = removeKnownDemoState(validation.state);
  if (withoutDemo !== validation.state) Taro.setStorageSync(STORAGE_KEY, withoutDemo);
  return withoutDemo;
}

export function saveFarmState(state: FarmState): void {
  const validation = validateFarmState(state);
  if (!validation.valid || !validation.state) throw new FarmDataError(validation.message);
  Taro.setStorageSync(STORAGE_KEY, validation.state);
}

export function saveRecoveryPoint(state: FarmState): void {
  Taro.setStorageSync(RECOVERY_KEY, { savedAt: new Date().toISOString(), state });
}

export async function loadExperienceExample(): Promise<FarmState> {
  const state = await loadFarmState();
  if (state.ponds.length || state.records.length) return state;

  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  const pondId = EXPERIENCE_POND_ID;
  const pond: Pond = {
    id: pondId,
    unitType: "pond",
    name: "示例对虾塘",
    species: "南美白对虾",
    location: "体验示例",
    areaMu: 6,
    status: "active",
    stockingDate: date,
    stockingQuantity: 300000,
    initialSize: "0.02",
    cultureStage: "苗期",
    alertProfileId: "shrimp",
    needsStockingDate: false,
    createdAt: now,
    updatedAt: now
  };
  const records: FarmRecord[] = [
    { id: "experience-water-1", pondId, type: "water", date, measuredAt: `${date} 08:30`, ph: 8.1, dissolvedOxygen: 6.2, ammoniaNitrogen: 0.05, temperature: 28, note: "晨检示例", createdAt: now, updatedAt: now },
    { id: "experience-feed-1", pondId, type: "feed", date, weightKg: 18, unitPriceYuan: 8.6, feedName: "虾料", meal: "早餐", appetite: "good", note: "投喂示例", createdAt: now, updatedAt: now },
    { id: "experience-sampling-1", pondId, type: "sampling", date, sampleCount: 30, averageWeightG: 0.3, estimatedStockQuantity: 285000, note: "抽样示例", createdAt: now, updatedAt: now }
  ];
  const next: FarmState = {
    ...state,
    ponds: [pond],
    records,
    settings: { ...state.settings, selectedPondId: pondId },
    migrationMeta: { ...state.migrationMeta, needsPondCompletion: false }
  };
  saveFarmState(next);
  return next;
}

export async function addPond(
  input: Omit<Pond, "id" | "status" | "needsStockingDate" | "createdAt" | "updatedAt">
): Promise<FarmState> {
  const state = await loadFarmState();
  const now = new Date().toISOString();
  const pond: Pond = { ...input, id: createId("pond"), status: "active", needsStockingDate: !input.stockingDate, createdAt: now, updatedAt: now };
  const next = {
    ...state,
    ponds: [pond, ...state.ponds],
    settings: { ...state.settings, selectedPondId: state.settings.selectedPondId || pond.id },
    migrationMeta: { ...state.migrationMeta, needsPondCompletion: state.ponds.some((item) => item.needsStockingDate) || pond.needsStockingDate }
  };
  saveFarmState(next);
  return next;
}

export async function updatePond(
  pondId: string,
  input: Omit<Pond, "id" | "status" | "needsStockingDate" | "createdAt" | "updatedAt">
): Promise<FarmState> {
  const state = await loadFarmState();
  const now = new Date().toISOString();
  const ponds = state.ponds.map((pond) =>
    pond.id === pondId ? { ...pond, ...input, needsStockingDate: !input.stockingDate, updatedAt: now } : pond
  );
  const next = { ...state, ponds, migrationMeta: { ...state.migrationMeta, needsPondCompletion: ponds.some((pond) => pond.needsStockingDate) } };
  saveFarmState(next);
  return next;
}

export async function deactivatePond(pondId: string): Promise<FarmState> {
  const state = await loadFarmState();
  const now = new Date().toISOString();
  const next = {
    ...state,
    ponds: state.ponds.map((pond) => (pond.id === pondId ? { ...pond, status: "inactive" as const, updatedAt: now } : pond))
  };
  saveFarmState(next);
  return next;
}

export async function deletePond(pondId: string): Promise<FarmState> {
  const state = await loadFarmState();
  const relatedRecordIds = state.records.filter((record) => record.pondId === pondId).map((record) => record.id);
  const ponds = state.ponds.filter((pond) => pond.id !== pondId);
  const records = state.records.filter((record) => record.pondId !== pondId);
  const selectedPondId = state.settings.selectedPondId === pondId ? ponds.find((pond) => pond.status === "active")?.id || ponds[0]?.id || "" : state.settings.selectedPondId;
  const next: FarmState = {
    ...state,
    ponds,
    records,
    settings: { ...state.settings, selectedPondId },
    syncMeta: {
      ...state.syncMeta,
      deletedPondIds: Array.from(new Set([...state.syncMeta.deletedPondIds, pondId])),
      deletedRecordIds: Array.from(new Set([...state.syncMeta.deletedRecordIds, ...relatedRecordIds]))
    }
  };
  saveFarmState(next);
  return next;
}

export async function setSelectedPond(pondId: string): Promise<FarmState> {
  const state = await loadFarmState();
  const next = { ...state, settings: { ...state.settings, selectedPondId: pondId } };
  saveFarmState(next);
  return next;
}

export async function setHomeView(homeView: HomeView): Promise<FarmState> {
  const state = await loadFarmState();
  const next = { ...state, settings: { ...state.settings, homeView } };
  saveFarmState(next);
  return next;
}

export async function setAccentMode(accentMode: AccentMode): Promise<FarmState> {
  const state = await loadFarmState();
  const next = { ...state, settings: { ...state.settings, accentMode } };
  saveFarmState(next);
  return next;
}

function prepareInput(input: FarmRecordInput): FarmRecordInput {
  if (input.type === "drug") return { ...input, withdrawalEndDate: addDaysToDate(input.date, input.withdrawalDays) };
  return input;
}

export async function addRecord(input: FarmRecordInput): Promise<FarmState> {
  const state = await loadFarmState();
  const pond = state.ponds.find((item) => item.id === input.pondId);
  if (!pond || pond.status !== "active") throw new FarmDataError("已停用或不存在的塘口不能新增记录");
  const now = new Date().toISOString();
  const record = { ...prepareInput(input), id: createId("record-" + input.type), createdAt: now, updatedAt: now } as FarmRecord;
  const next = { ...state, records: [record, ...state.records] };
  saveFarmState(next);
  return next;
}

export async function updateRecord(recordId: string, input: FarmRecordInput): Promise<FarmState> {
  const state = await loadFarmState();
  const existing = state.records.find((record) => record.id === recordId);
  if (!existing) return state;
  const updated = { ...prepareInput(input), id: existing.id, createdAt: existing.createdAt, updatedAt: new Date().toISOString() } as FarmRecord;
  const next = { ...state, records: state.records.map((record) => (record.id === recordId ? updated : record)) };
  saveFarmState(next);
  return next;
}

export async function deleteRecord(recordId: string): Promise<FarmState> {
  const state = await loadFarmState();
  const next = {
    ...state,
    records: state.records.filter((record) => record.id !== recordId),
    syncMeta: {
      ...state.syncMeta,
      deletedRecordIds: Array.from(new Set([...state.syncMeta.deletedRecordIds, recordId]))
    }
  };
  saveFarmState(next);
  return next;
}

export function normalizeIncomingState(value: unknown): FarmState {
  const migrated = migrateFarmState(value);
  const validation = validateFarmState(migrated);
  if (!validation.valid || !validation.state) throw new FarmDataError(validation.message);
  return validation.state;
}

export function removeKnownDemoState(state: FarmState): FarmState {
  const pondIds = state.ponds.map((pond) => pond.id).sort();
  const recordIds = state.records.map((record) => record.id).sort();
  const isOriginalDemo =
    pondIds.length === DEMO_POND_IDS.length &&
    recordIds.length === DEMO_RECORD_IDS.length &&
    pondIds.every((id, index) => id === [...DEMO_POND_IDS].sort()[index]) &&
    recordIds.every((id, index) => id === [...DEMO_RECORD_IDS].sort()[index]);
  if (!isOriginalDemo) return state;
  return {
    ...state,
    ponds: [],
    records: [],
    settings: { ...state.settings, selectedPondId: "" },
    migrationMeta: { ...state.migrationMeta, needsPondCompletion: false }
  };
}

export function hasExperienceExample(state: FarmState): boolean {
  return state.ponds.some((pond) => pond.id === EXPERIENCE_POND_ID);
}
