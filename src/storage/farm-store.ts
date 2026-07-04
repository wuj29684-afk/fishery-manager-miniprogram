import Taro from "@tarojs/taro";
import { seedFarmState } from "../data/seed";
import { createId } from "../domain/id";
import type { FarmRecord, FarmRecordInput, FarmState, Pond } from "../types";

const STORAGE_KEY = "fishery-manager:farm-state:v1";

function cloneSeed(): FarmState {
  return JSON.parse(JSON.stringify(seedFarmState)) as FarmState;
}

function normalizeFarmState(state: FarmState): FarmState {
  return {
    ...state,
    ponds: state.ponds.map((pond) => ({
      ...pond,
      status: pond.status ?? "active"
    }))
  };
}

export async function loadFarmState(): Promise<FarmState> {
  try {
    const stored = Taro.getStorageSync<FarmState>(STORAGE_KEY);
    if (stored?.version === 1) {
      return normalizeFarmState(stored);
    }
  } catch {
    // Fall through to seed data when local storage is unavailable or invalid.
  }

  const seeded = cloneSeed();
  saveFarmState(seeded);
  return seeded;
}

export function saveFarmState(state: FarmState): void {
  Taro.setStorageSync(STORAGE_KEY, state);
}

export async function addPond(input: Omit<Pond, "id" | "status" | "createdAt" | "updatedAt">): Promise<FarmState> {
  const state = await loadFarmState();
  const now = new Date().toISOString();
  const pond: Pond = {
    ...input,
    id: createId("pond"),
    status: "active",
    createdAt: now,
    updatedAt: now
  };
  const next = { ...state, ponds: [pond, ...state.ponds] };
  saveFarmState(next);
  return next;
}

export async function updatePond(pondId: string, input: Omit<Pond, "id" | "status" | "createdAt" | "updatedAt">): Promise<FarmState> {
  const state = await loadFarmState();
  const now = new Date().toISOString();
  const next: FarmState = {
    ...state,
    ponds: state.ponds.map((pond) =>
      pond.id === pondId
        ? {
            ...pond,
            ...input,
            updatedAt: now
          }
        : pond
    )
  };
  saveFarmState(next);
  return next;
}

export async function deactivatePond(pondId: string): Promise<FarmState> {
  const state = await loadFarmState();
  const now = new Date().toISOString();
  const next: FarmState = {
    ...state,
    ponds: state.ponds.map((pond) =>
      pond.id === pondId
        ? {
            ...pond,
            status: "inactive",
            updatedAt: now
          }
        : pond
    )
  };
  saveFarmState(next);
  return next;
}

export async function addRecord(input: FarmRecordInput): Promise<FarmState> {
  const state = await loadFarmState();
  const record = {
    ...input,
    id: createId(`record-${input.type}`),
    createdAt: new Date().toISOString()
  } as FarmRecord;
  const next = { ...state, records: [record, ...state.records] };
  saveFarmState(next);
  return next;
}

export async function updateRecord(recordId: string, input: FarmRecordInput): Promise<FarmState> {
  const state = await loadFarmState();
  const existing = state.records.find((record) => record.id === recordId);
  if (!existing) {
    return state;
  }

  const updated = {
    ...input,
    id: existing.id,
    createdAt: existing.createdAt
  } as FarmRecord;
  const next = {
    ...state,
    records: state.records.map((record) => (record.id === recordId ? updated : record))
  };
  saveFarmState(next);
  return next;
}

export async function deleteRecord(recordId: string): Promise<FarmState> {
  const state = await loadFarmState();
  const next = {
    ...state,
    records: state.records.filter((record) => record.id !== recordId)
  };
  saveFarmState(next);
  return next;
}
