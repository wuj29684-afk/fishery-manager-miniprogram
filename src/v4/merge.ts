import type { V4Conflict, V4Record, V4State } from "./types";

function same(valueA: unknown, valueB: unknown): boolean {
  return JSON.stringify(valueA) === JSON.stringify(valueB);
}

function mergeRecords(
  base: V4Record[],
  local: V4Record[],
  remote: V4Record[],
  conflicts: V4Conflict[]
): V4Record[] {
  const baseMap = new Map(base.map((record) => [record.id, record]));
  const localMap = new Map(local.map((record) => [record.id, record]));
  const remoteMap = new Map(remote.map((record) => [record.id, record]));
  const result = new Map<string, V4Record>();
  const ids = new Set([...baseMap.keys(), ...localMap.keys(), ...remoteMap.keys()]);
  ids.forEach((id) => {
    const baseRecord = baseMap.get(id);
    const localRecord = localMap.get(id);
    const remoteRecord = remoteMap.get(id);
    if (!localRecord && !remoteRecord) return;
    if (!baseRecord) {
      if (localRecord && remoteRecord && !same(localRecord, remoteRecord)) {
        conflicts.push({
          id: `record:${id}`,
          entityType: "record",
          entityId: id,
          field: "*",
          localValue: localRecord,
          remoteValue: remoteRecord
        });
      }
      result.set(id, localRecord || remoteRecord as V4Record);
      return;
    }
    if (!localRecord || !remoteRecord) {
      const survivor = localRecord || remoteRecord;
      if (survivor && !same(survivor, baseRecord)) {
        conflicts.push({
          id: `record:${id}:delete`,
          entityType: "record",
          entityId: id,
          field: "deleted",
          localValue: localRecord,
          remoteValue: remoteRecord
        });
        result.set(id, survivor);
      }
      return;
    }
    const localChanged = !same(localRecord, baseRecord);
    const remoteChanged = !same(remoteRecord, baseRecord);
    if (localChanged && remoteChanged && !same(localRecord, remoteRecord)) {
      conflicts.push({
        id: `record:${id}:change`,
        entityType: "record",
        entityId: id,
        field: "*",
        localValue: localRecord,
        remoteValue: remoteRecord
      });
      result.set(id, localRecord);
    } else {
      result.set(id, remoteChanged ? remoteRecord : localRecord);
    }
  });
  return [...result.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function mergeV4States(
  base: V4State,
  local: V4State,
  remote: V4State
): { state: V4State; conflicts: V4Conflict[] } {
  const conflicts: V4Conflict[] = [];
  const records = mergeRecords(base.records, local.records, remote.records, conflicts);
  const state: V4State = {
    ...local,
    records,
    syncMeta: {
      ...local.syncMeta,
      conflicts,
      status: conflicts.length ? "conflict" : "pending",
      message: conflicts.length ? `${conflicts.length} 项待处理` : "合并完成，等待同步"
    }
  };
  return { state, conflicts };
}

