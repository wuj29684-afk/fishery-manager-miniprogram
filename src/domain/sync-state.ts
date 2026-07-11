import { createSyncChecksum } from "./sync-payload";
import { validateFarmState } from "./state-validation";
import type { FarmRecord, FarmState, Pond } from "../types";

export interface PulledSyncState {
  protocolVersion?: number;
  schemaVersion?: number;
  serverRevision: number;
  syncedAt?: string;
  ponds: Array<Pond & { ownerUserId?: string }>;
  records: Array<FarmRecord & { ownerUserId?: string }>;
  pondCount?: number;
  recordCount?: number;
  checksum?: string;
  conflict?: boolean;
}

function stripOwner<T>(item: T & { ownerUserId?: string }): Omit<T, "ownerUserId"> {
  const { ownerUserId: _ignored, ...rest } = item as T & { ownerUserId?: string };
  return rest;
}

export function createLocalStateFromPullResult(result: PulledSyncState, local?: FarmState): FarmState {
  const ponds = result.ponds.map((pond) => stripOwner(pond) as unknown as Pond);
  const records = result.records.map((record) => stripOwner(record) as unknown as FarmRecord);
  if (result.pondCount !== undefined && result.pondCount !== ponds.length) throw new Error("云端塘口数据不完整");
  if (result.recordCount !== undefined && result.recordCount !== records.length) throw new Error("云端记录数据不完整");
  if (result.checksum && result.checksum !== createSyncChecksum(ponds, records)) throw new Error("云端数据完整性校验失败");
  const candidate = {
    version: 2,
    ponds,
    records,
    settings: local?.settings || { selectedPondId: ponds[0]?.id || "", customProfileThresholds: {} },
    syncMeta: {
      protocolVersion: 2,
      serverRevision: result.serverRevision,
      lastSyncedAt: result.syncedAt || new Date().toISOString(),
      deviceId: local?.syncMeta.deviceId || "",
      status: "synced",
      message: "账号数据已同步",
      deletedPondIds: [],
      deletedRecordIds: []
    },
    migrationMeta: local?.migrationMeta || { sourceVersion: 2, migratedAt: new Date().toISOString(), needsPondCompletion: false }
  };
  const validation = validateFarmState(candidate);
  if (!validation.valid || !validation.state) throw new Error(validation.message || "云端数据格式不正确");
  return validation.state;
}
