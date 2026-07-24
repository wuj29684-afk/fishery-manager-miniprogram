import { migrateFarmState } from "../domain/farm-state";
import { createId } from "../domain/id";
import type { FarmRecord } from "../types";
import type {
  V4Batch,
  V4Farm,
  V4Record,
  V4RecordType,
  V4State,
  V4Task,
  V4Unit
} from "./types";

function markPending(state: V4State, entityId: string): V4State {
  return {
    ...state,
    syncMeta: {
      ...state.syncMeta,
      pendingEntityIds: Array.from(new Set([...state.syncMeta.pendingEntityIds, entityId])),
      status: "pending",
      message: "有数据待同步"
    }
  };
}

export function createV4State(now = new Date().toISOString(), userId = ""): V4State {
  return {
    version: 3,
    auth: { status: "guest", userId, displayName: "" },
    farms: [],
    members: [],
    units: [],
    batches: [],
    records: [],
    inventory: [],
    inventoryMovements: [],
    tasks: [],
    templates: [],
    deletionAudit: [],
    telemetry: [],
    settings: {
      selectedFarmId: "",
      selectedUnitId: "",
      weightUnit: "jin",
      quickRecordTypes: ["feed", "water", "patrol", "mortality"],
      homeMode: "record",
      telemetryEnabled: true,
      autoSyncEnabled: true
    },
    syncMeta: {
      protocolVersion: 4,
      baseRevision: 0,
      pendingEntityIds: [],
      conflicts: [],
      status: "local",
      lastSyncedAt: "",
      message: "本机数据"
    },
    migration: { sourceVersion: 3, migratedAt: now, legacyBackupCreated: false }
  };
}

export function createFarm(
  state: V4State,
  input: Pick<V4Farm, "name" | "province" | "city" | "district">,
  actorId: string,
  now = new Date().toISOString()
): V4State {
  if (!input.name.trim()) throw new Error("请填写养殖场名称");
  const farm: V4Farm = {
    ...input,
    id: createId("farm"),
    ownerUserId: actorId,
    status: "active",
    createdAt: now,
    updatedAt: now
  };
  const memberId = createId("member");
  return markPending({
    ...state,
    farms: [...state.farms, farm],
    members: [...state.members, {
      id: memberId,
      farmId: farm.id,
      userId: actorId,
      displayName: state.auth.displayName || "老板",
      role: "owner",
      unitIds: [],
      canViewFinance: true,
      status: "active",
      createdAt: now,
      updatedAt: now
    }],
    settings: { ...state.settings, selectedFarmId: state.settings.selectedFarmId || farm.id }
  }, farm.id);
}

export function createUnit(
  state: V4State,
  input: Omit<V4Unit, "id" | "status" | "createdAt" | "updatedAt">,
  _actorId: string,
  now = new Date().toISOString()
): V4State {
  if (!state.farms.some((farm) => farm.id === input.farmId)) throw new Error("养殖场不存在");
  const unit: V4Unit = { ...input, id: createId("unit"), status: "active", createdAt: now, updatedAt: now };
  return markPending({
    ...state,
    units: [...state.units, unit],
    settings: { ...state.settings, selectedUnitId: state.settings.selectedUnitId || unit.id }
  }, unit.id);
}

export function startBatch(
  state: V4State,
  input: Omit<V4Batch, "id" | "status" | "createdAt" | "updatedAt">,
  _actorId: string,
  now = new Date().toISOString()
): V4State {
  if (state.batches.some((batch) => batch.unitId === input.unitId && batch.status !== "completed")) {
    throw new Error("该养殖单元已有进行中批次");
  }
  if (!state.units.some((unit) => unit.id === input.unitId && unit.farmId === input.farmId)) {
    throw new Error("养殖单元不存在");
  }
  const batch: V4Batch = {
    ...input,
    id: createId("batch"),
    status: input.stockingDate ? "culturing" : "preparing",
    createdAt: now,
    updatedAt: now
  };
  return markPending({ ...state, batches: [...state.batches, batch] }, batch.id);
}

export function finishBatch(
  state: V4State,
  batchId: string,
  actorId: string,
  now = new Date().toISOString()
): V4State {
  const batch = state.batches.find((item) => item.id === batchId);
  if (!batch || batch.status === "completed") throw new Error("进行中的养殖批次不存在");
  return markPending({
    ...state,
    batches: state.batches.map((item) => item.id === batchId ? { ...item, status: "completed", endedAt: now, updatedAt: now } : item)
  }, batchId);
}

export function deleteUnitPermanent(
  state: V4State,
  unitId: string,
  actorId: string,
  now = new Date().toISOString()
): V4State {
  const unit = state.units.find((item) => item.id === unitId);
  if (!unit) return state;
  const batchIds = new Set(state.batches.filter((batch) => batch.unitId === unitId).map((batch) => batch.id));
  return markPending({
    ...state,
    units: state.units.filter((item) => item.id !== unitId),
    batches: state.batches.filter((batch) => batch.unitId !== unitId),
    records: state.records.filter((record) => record.unitId !== unitId),
    inventoryMovements: state.inventoryMovements.filter((movement) => !movement.batchId || !batchIds.has(movement.batchId)),
    deletionAudit: [...state.deletionAudit, {
      id: createId("delete"),
      farmId: unit.farmId,
      entityType: "unit",
      entityId: unit.id,
      entityLabel: unit.name,
      deletedBy: actorId,
      deletedAt: now
    }]
  }, unitId);
}

export function createTemplate(
  state: V4State,
  input: V4State["templates"][number],
): V4State {
  if (!input.name.trim()) throw new Error("请填写模板名称");
  if (input.fields.length > 5) throw new Error("每个模板最多 5 个字段");
  return markPending({ ...state, templates: [...state.templates, input] }, input.id);
}

export function resolveV4Conflict(
  state: V4State,
  conflictId: string,
  choice: "local" | "remote"
): V4State {
  const conflict = state.syncMeta.conflicts.find((item) => item.id === conflictId);
  if (!conflict) return state;
  let records = state.records;
  if (conflict.entityType === "record" && conflict.field === "*") {
    const selected = choice === "local" ? conflict.localValue : conflict.remoteValue;
    records = records.filter((record) => record.id !== conflict.entityId);
    if (selected && typeof selected === "object") records = [selected as V4Record, ...records];
  }
  const conflicts = state.syncMeta.conflicts.filter((item) => item.id !== conflictId);
  return {
    ...state,
    records,
    syncMeta: {
      ...state.syncMeta,
      conflicts,
      status: conflicts.length ? "conflict" : "pending",
      message: conflicts.length ? `${conflicts.length} 项冲突待处理` : "冲突已处理，等待同步"
    }
  };
}

export function addV4Record(
  state: V4State,
  input: Omit<V4Record, "id" | "photos" | "createdBy" | "updatedBy" | "createdAt" | "updatedAt"> & { photos?: string[] },
  actorId: string,
  now = new Date().toISOString()
): V4State {
  const batch = state.batches.find((item) => item.id === input.batchId);
  if (!batch || batch.unitId !== input.unitId || batch.farmId !== input.farmId) throw new Error("养殖批次不存在");
  const record: V4Record = {
    ...input,
    id: createId(`record-${input.type}`),
    photos: input.photos || [],
    createdBy: actorId,
    updatedBy: actorId,
    createdAt: now,
    updatedAt: now
  };
  return markPending({ ...state, records: [record, ...state.records] }, record.id);
}

export function deleteV4Record(
  state: V4State,
  recordId: string,
  actorId: string,
  now = new Date().toISOString()
): V4State {
  const record = state.records.find((item) => item.id === recordId);
  if (!record) return state;
  return markPending({
    ...state,
    records: state.records.filter((item) => item.id !== recordId),
    deletionAudit: [...state.deletionAudit, {
      id: createId("delete"),
      farmId: record.farmId,
      entityType: "record",
      entityId: record.id,
      entityLabel: record.type,
      deletedBy: actorId,
      deletedAt: now
    }]
  }, record.id);
}

export function updateTaskCompletion(state: V4State, date: string): V4State {
  const tasks = state.tasks.map((task: V4Task) => {
    const completed = state.records.some((record) =>
      record.date === date &&
      record.type === task.type &&
      (!task.unitId || task.unitId === record.unitId) &&
      (!task.batchId || task.batchId === record.batchId)
    );
    return completed ? { ...task, lastCompletedDate: date } : task;
  });
  return { ...state, tasks };
}

function recordData(record: FarmRecord): Record<string, unknown> {
  const baseKeys = new Set(["id", "pondId", "type", "date", "note", "createdAt", "updatedAt"]);
  return Object.fromEntries(Object.entries(record).filter(([key]) => !baseKeys.has(key)));
}

function mapRecordType(type: FarmRecord["type"]): V4RecordType {
  return type;
}

export function migrateV2ToV4(
  value: unknown,
  now = new Date().toISOString(),
  userId = ""
): V4State {
  const legacy = migrateFarmState(value, now);
  const state = createV4State(now, userId);
  const farmId = "farm-migrated";
  const farm: V4Farm = {
    id: farmId,
    name: "我的养殖场",
    ownerUserId: userId,
    province: "",
    city: "",
    district: "",
    status: "active",
    createdAt: legacy.ponds[0]?.createdAt || now,
    updatedAt: now
  };
  const units: V4Unit[] = legacy.ponds.map((pond) => ({
    id: pond.id,
    farmId,
    type: pond.unitType,
    name: pond.name,
    location: pond.location,
    areaMu: pond.areaMu,
    lengthM: pond.cageLengthM,
    widthM: pond.cageWidthM,
    depthM: pond.cageDepthM,
    status: pond.status,
    createdAt: pond.createdAt,
    updatedAt: pond.updatedAt
  }));
  const batches: V4Batch[] = legacy.ponds.map((pond) => ({
    id: `batch-${pond.id}`,
    farmId,
    unitId: pond.id,
    species: pond.species,
    status: pond.status === "active" ? "culturing" : "completed",
    stockingDate: pond.stockingDate,
    stockingQuantity: pond.stockingQuantity,
    initialAverageWeightG: pond.initialSize ? Number(pond.initialSize) : undefined,
    targetHarvestDate: pond.targetHarvestDate,
    createdAt: pond.createdAt,
    updatedAt: pond.updatedAt
  }));
  const batchByUnit = new Map(batches.map((batch) => [batch.unitId, batch.id]));
  const records: V4Record[] = legacy.records.map((record) => ({
    id: record.id,
    farmId,
    unitId: record.pondId,
    batchId: batchByUnit.get(record.pondId) || "",
    type: mapRecordType(record.type),
    date: record.date,
    note: record.note,
    data: recordData(record),
    photos: [],
    createdBy: userId,
    updatedBy: userId,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  }));
  return {
    ...state,
    farms: [farm],
    members: [{
      id: "member-owner-migrated",
      farmId,
      userId,
      displayName: "老板",
      role: "owner",
      unitIds: [],
      canViewFinance: true,
      status: "active",
      createdAt: now,
      updatedAt: now
    }],
    units,
    batches,
    records,
    settings: {
      ...state.settings,
      selectedFarmId: farmId,
      selectedUnitId: legacy.settings.selectedPondId
    },
    migration: {
      sourceVersion: legacy.migrationMeta.sourceVersion,
      migratedAt: now,
      legacyBackupCreated: false
    }
  };
}
