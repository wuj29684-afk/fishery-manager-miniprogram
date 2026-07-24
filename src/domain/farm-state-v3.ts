import { migrateFarmState } from "./farm-state";
import type {
  AccentMode,
  AlertProfileId,
  FarmRecord,
  FarmSettings,
  HomeView,
  Pond,
  SyncMeta,
  WaterThresholds
} from "../types";

export type FarmStatus = "active" | "inactive";
export type CultureBatchStatus = "preparing" | "culturing" | "completed";

export interface Farm {
  id: string;
  name: string;
  status: FarmStatus;
  createdAt: string;
  updatedAt: string;
}

export interface FarmUnitV3 extends Pond {
  farmId: string;
}

export interface CultureBatch {
  id: string;
  farmId: string;
  pondId: string;
  name: string;
  status: CultureBatchStatus;
  species: string;
  stockingDate?: string;
  stockingQuantity?: number;
  initialSize?: string;
  cultureStage?: string;
  alertProfileId: AlertProfileId;
  customThresholds?: Partial<WaterThresholds>;
  targetHarvestDate?: string;
  legacyStockingDays?: number;
  needsStockingDate: boolean;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
}

export type FarmRecordV3 = FarmRecord & {
  farmId: string;
  batchId: string;
};

export interface FarmSettingsV3 extends FarmSettings {
  selectedFarmId: string;
  selectedPondId: string;
  homeView: HomeView;
  accentMode: AccentMode;
}

export interface MigrationMetaV3 {
  sourceVersion: 1 | 2 | 3;
  migratedAt: string;
  needsPondCompletion: boolean;
}

export interface FarmStateV3 {
  version: 3;
  farms: Farm[];
  ponds: FarmUnitV3[];
  batches: CultureBatch[];
  records: FarmRecordV3[];
  settings: FarmSettingsV3;
  syncMeta: SyncMeta;
  migrationMeta: MigrationMetaV3;
}

const DEFAULT_FARM_ID = "farm-default";

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertUniqueIds(items: Array<{ id: string }>, label: string): void {
  const ids = items.map((item) => item.id);
  if (ids.some((id) => !id) || new Set(ids).size !== ids.length) {
    throw new Error(`${label} ID 缺失或重复`);
  }
}

function assertFarmStateV3(state: FarmStateV3): void {
  if (!state.farms.length) throw new Error("至少需要一个养殖场");
  assertUniqueIds(state.farms, "养殖场");
  assertUniqueIds(state.ponds, "养殖单元");
  assertUniqueIds(state.batches, "养殖批次");
  assertUniqueIds(state.records, "记录");

  const farmIds = new Set(state.farms.map((farm) => farm.id));
  const pondIds = new Set(state.ponds.map((pond) => pond.id));
  const batches = new Map(state.batches.map((batch) => [batch.id, batch]));

  if (!state.ponds.every((pond) => farmIds.has(pond.farmId))) {
    throw new Error("养殖单元关联的养殖场不存在");
  }
  if (!state.batches.every((batch) => farmIds.has(batch.farmId) && pondIds.has(batch.pondId))) {
    throw new Error("养殖批次关联的养殖场或养殖单元不存在");
  }
  if (
    !state.records.every((record) => {
      const batch = batches.get(record.batchId);
      return batch && batch.farmId === record.farmId && batch.pondId === record.pondId;
    })
  ) {
    throw new Error("记录关联的养殖场、养殖单元或养殖批次不存在");
  }
  if (!farmIds.has(state.settings.selectedFarmId)) {
    throw new Error("当前养殖场不存在");
  }
}

function isFarmStateV3(value: unknown): value is FarmStateV3 {
  return Boolean(
    isObject(value) &&
      value.version === 3 &&
      Array.isArray(value.farms) &&
      Array.isArray(value.ponds) &&
      Array.isArray(value.batches) &&
      Array.isArray(value.records) &&
      isObject(value.settings) &&
      isObject(value.syncMeta) &&
      isObject(value.migrationMeta)
  );
}

function batchIdForPond(pondId: string): string {
  return `batch-${pondId}`;
}

function createInitialBatch(pond: FarmUnitV3): CultureBatch {
  return {
    id: batchIdForPond(pond.id),
    farmId: pond.farmId,
    pondId: pond.id,
    name: `${pond.name}首批`,
    status: pond.status === "active" ? "culturing" : "completed",
    species: pond.species,
    stockingDate: pond.stockingDate,
    stockingQuantity: pond.stockingQuantity,
    initialSize: pond.initialSize,
    cultureStage: pond.cultureStage,
    alertProfileId: pond.alertProfileId,
    customThresholds: pond.customThresholds,
    targetHarvestDate: pond.targetHarvestDate,
    legacyStockingDays: pond.legacyStockingDays,
    needsStockingDate: pond.needsStockingDate,
    createdAt: pond.createdAt,
    updatedAt: pond.updatedAt
  };
}

export function migrateFarmStateToV3(value: unknown, now = new Date().toISOString()): FarmStateV3 {
  if (isFarmStateV3(value)) {
    assertFarmStateV3(value);
    return value;
  }

  const sourceVersion = isObject(value) && value.version === 2 ? 2 : 1;
  const legacy = migrateFarmState(value, now);
  const timestamps = legacy.ponds.flatMap((pond) => [pond.createdAt, pond.updatedAt]).filter(Boolean).sort();
  const farm: Farm = {
    id: DEFAULT_FARM_ID,
    name: "我的养殖场",
    status: "active",
    createdAt: timestamps[0] || now,
    updatedAt: timestamps[timestamps.length - 1] || now
  };
  const ponds: FarmUnitV3[] = legacy.ponds.map((pond) => ({ ...pond, farmId: farm.id }));
  const batches = ponds.map(createInitialBatch);
  const batchByPond = new Map(batches.map((batch) => [batch.pondId, batch]));
  const records: FarmRecordV3[] = legacy.records.map((record) => {
    const batch = batchByPond.get(record.pondId);
    if (!batch) throw new Error("旧记录关联的养殖单元不存在");
    return { ...record, farmId: farm.id, batchId: batch.id } as FarmRecordV3;
  });
  const state: FarmStateV3 = {
    version: 3,
    farms: [farm],
    ponds,
    batches,
    records,
    settings: {
      ...legacy.settings,
      selectedFarmId: farm.id
    },
    syncMeta: legacy.syncMeta,
    migrationMeta: {
      sourceVersion,
      migratedAt: now,
      needsPondCompletion: legacy.migrationMeta.needsPondCompletion
    }
  };
  assertFarmStateV3(state);
  return state;
}
