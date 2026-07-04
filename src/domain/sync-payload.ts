import type { FarmRecord, FarmState, Pond } from "../types";

export interface SyncPushPayload {
  deviceId: string;
  lastSyncedAt?: string;
  ponds: Pond[];
  records: FarmRecord[];
}

function stripOwner<T extends Record<string, unknown>>(item: T): Omit<T, "ownerUserId"> {
  const { ownerUserId: _ignored, ...rest } = item;
  return rest;
}

export function createSyncPushPayload(state: FarmState, deviceId: string, lastSyncedAt?: string): SyncPushPayload {
  return {
    deviceId,
    lastSyncedAt,
    ponds: state.ponds.map((pond) => stripOwner(pond as unknown as Record<string, unknown>) as unknown as Pond),
    records: state.records.map((record) => stripOwner(record as unknown as Record<string, unknown>) as unknown as FarmRecord)
  };
}
