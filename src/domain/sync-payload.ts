import type { FarmRecord, FarmState, Pond } from "../types";

export interface SyncSummary {
  pondCount: number;
  recordCount: number;
  checksum: string;
}

export interface SyncPushPayload extends SyncSummary {
  protocolVersion: 3;
  schemaVersion: 2;
  deviceId: string;
  baseRevision: number;
  force: boolean;
  lastSyncedAt?: string;
  ponds: Pond[];
  records: FarmRecord[];
  deletedPondIds: string[];
  deletedRecordIds: string[];
}

function stripOwner<T extends Record<string, unknown>>(item: T): Omit<T, "ownerUserId"> {
  const { ownerUserId: _ignored, ...rest } = item;
  return rest;
}

export function createSyncChecksum(ponds: Array<{ id: string; updatedAt?: string }>, records: Array<{ id: string; updatedAt?: string }>): string {
  const source = [...ponds, ...records]
    .map((item) => item.id + ":" + (item.updatedAt || ""))
    .sort()
    .join("|");
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function createSyncPushPayload(state: FarmState, deviceId: string, force = false): SyncPushPayload {
  const ponds = state.ponds.map((pond) => stripOwner(pond as unknown as Record<string, unknown>) as unknown as Pond);
  const records = state.records.map((record) => stripOwner(record as unknown as Record<string, unknown>) as unknown as FarmRecord);
  return {
    protocolVersion: 3,
    schemaVersion: 2,
    deviceId,
    baseRevision: state.syncMeta.serverRevision,
    force,
    lastSyncedAt: state.syncMeta.lastSyncedAt || undefined,
    ponds,
    records,
    deletedPondIds: state.syncMeta.deletedPondIds,
    deletedRecordIds: state.syncMeta.deletedRecordIds,
    pondCount: ponds.length,
    recordCount: records.length,
    checksum: createSyncChecksum(ponds, records)
  };
}
