import type { FarmRecord, FarmState, Pond } from "../types";

export interface PulledSyncState {
  serverRevision: number;
  ponds: Array<Pond & { ownerUserId?: string }>;
  records: Array<FarmRecord & { ownerUserId?: string }>;
}

function stripOwner<T>(item: T & { ownerUserId?: string }): Omit<T, "ownerUserId"> {
  const { ownerUserId: _ignored, ...rest } = item as T & { ownerUserId?: string };
  return rest;
}

export function createLocalStateFromPullResult(result: PulledSyncState): FarmState {
  return {
    version: 1,
    ponds: result.ponds.map((pond) => stripOwner(pond) as unknown as Pond),
    records: result.records.map((record) => stripOwner(record) as unknown as FarmRecord)
  };
}
