import Taro from "@tarojs/taro";
import { createEmptyFarmState, migrateFarmState } from "../domain/farm-state";
import { createId } from "../domain/id";
import { validateFarmState } from "../domain/state-validation";
import { addDaysToDate } from "../domain/withdrawal";
import type { FarmRecord, FarmRecordInput, FarmState, Pond } from "../types";

const STORAGE_KEY = "fishery-manager:farm-state:v1";
const MIGRATION_BACKUP_KEY = "fishery-manager:farm-state:v1:migration-backup";
const RECOVERY_KEY = "fishery-manager:farm-state:v2:recovery";

export class FarmDataError extends Error {}

export async function loadFarmState(): Promise<FarmState> {
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
  return validation.state;
}

export function saveFarmState(state: FarmState): void {
  const validation = validateFarmState(state);
  if (!validation.valid || !validation.state) throw new FarmDataError(validation.message);
  Taro.setStorageSync(STORAGE_KEY, validation.state);
}

export function saveRecoveryPoint(state: FarmState): void {
  Taro.setStorageSync(RECOVERY_KEY, { savedAt: new Date().toISOString(), state });
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

export async function setSelectedPond(pondId: string): Promise<FarmState> {
  const state = await loadFarmState();
  const next = { ...state, settings: { ...state.settings, selectedPondId: pondId } };
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
