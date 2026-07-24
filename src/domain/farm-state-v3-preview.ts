import { createEmptyFarmState } from "./farm-state";
import { migrateFarmStateToV3 } from "./farm-state-v3";
import type { FarmStateV3 } from "./farm-state-v3";

export const FARM_STATE_V3_PREVIEW_KEY = "fishery-manager:farm-state:v3:preview";

export interface FarmStateV3PreviewSummary {
  sourceVersion: 1 | 2 | 3;
  farmCount: number;
  unitCount: number;
  batchCount: number;
  recordCount: number;
  warnings: string[];
}

export interface FarmStateV3Preview {
  generatedAt: string;
  state: FarmStateV3;
  summary: FarmStateV3PreviewSummary;
}

export interface FarmStateV3PreviewStorage {
  get(key: string): unknown;
  set(key: string, value: unknown): void;
  remove(key: string): void;
}

export interface FarmStateV3PreviewRepository {
  save(value: unknown, now?: string): FarmStateV3Preview;
  load(): FarmStateV3Preview | null;
  clear(): void;
}

function previewWarnings(state: FarmStateV3): string[] {
  const missingStockingDate = state.batches.filter((batch) => batch.needsStockingDate).length;
  return missingStockingDate ? [`${missingStockingDate} 个养殖单元缺少投苗日期`] : [];
}

function isStoredPreview(value: unknown): value is FarmStateV3Preview {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const preview = value as Partial<FarmStateV3Preview>;
  return Boolean(
    typeof preview.generatedAt === "string" &&
      preview.state?.version === 3 &&
      preview.summary &&
      Array.isArray(preview.summary.warnings)
  );
}

export function createFarmStateV3Preview(
  value: unknown,
  now = new Date().toISOString()
): FarmStateV3Preview {
  const state = migrateFarmStateToV3(value, now);
  return {
    generatedAt: now,
    state,
    summary: {
      sourceVersion: state.migrationMeta.sourceVersion,
      farmCount: state.farms.length,
      unitCount: state.ponds.length,
      batchCount: state.batches.length,
      recordCount: state.records.length,
      warnings: previewWarnings(state)
    }
  };
}

export function createFarmStateV3PreviewRepository(
  storage: FarmStateV3PreviewStorage
): FarmStateV3PreviewRepository {
  return {
    save(value, now) {
      const preview = createFarmStateV3Preview(value, now);
      storage.set(FARM_STATE_V3_PREVIEW_KEY, preview);
      return preview;
    },
    load() {
      const preview = storage.get(FARM_STATE_V3_PREVIEW_KEY);
      if (preview === undefined || preview === null || preview === "") return null;
      if (!isStoredPreview(preview)) throw new Error("v3 迁移预览格式不正确");
      migrateFarmStateToV3(preview.state, preview.generatedAt);
      return preview;
    },
    clear() {
      storage.remove(FARM_STATE_V3_PREVIEW_KEY);
    }
  };
}

export function inspectFarmStateV3Storage(
  storage: FarmStateV3PreviewStorage,
  sourceKey: string,
  now = new Date().toISOString()
): FarmStateV3Preview {
  const source = storage.get(sourceKey);
  const value = source === undefined || source === null || source === ""
    ? createEmptyFarmState(now)
    : source;
  return createFarmStateV3PreviewRepository(storage).save(value, now);
}
