import { migrateFarmState } from "./farm-state";
import type { FarmRecord, FarmState, Pond, RecordType } from "../types";

export interface StateValidationResult {
  valid: boolean;
  message: string;
  state?: FarmState;
}

const recordTypes: RecordType[] = ["feed", "water", "drug", "harvest", "sampling", "mortality", "expense"];

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  return new Date(value + "T00:00:00.000Z").toISOString().slice(0, 10) === value;
}

function finite(value: unknown, min = 0): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= min;
}

function validPond(pond: Pond): boolean {
  return Boolean(
    pond.id &&
      pond.name.trim() &&
      pond.species.trim() &&
      finite(pond.areaMu) &&
      ["active", "inactive"].includes(pond.status) &&
      ["shrimp", "tilapia", "general"].includes(pond.alertProfileId) &&
      (!pond.stockingDate || validDate(pond.stockingDate))
  );
}

function validRecord(record: FarmRecord, pondIds: Set<string>): boolean {
  if (!record.id || !pondIds.has(record.pondId) || !recordTypes.includes(record.type) || !validDate(record.date)) return false;
  if (record.type === "feed" || record.type === "harvest") return finite(record.weightKg) && finite(record.unitPriceYuan);
  if (record.type === "water") {
    return finite(record.ph) && record.ph <= 14 && finite(record.dissolvedOxygen) && finite(record.ammoniaNitrogen);
  }
  if (record.type === "drug") return Boolean(record.drugName.trim() && record.dosage.trim() && finite(record.withdrawalDays));
  if (record.type === "sampling") return finite(record.sampleCount) && finite(record.averageWeightG);
  if (record.type === "mortality") return finite(record.count);
  return Boolean(record.itemName.trim() && finite(record.amountYuan));
}

export function validateFarmState(value: unknown): StateValidationResult {
  let state: FarmState;
  try {
    state = migrateFarmState(value);
  } catch (error) {
    return { valid: false, message: error instanceof Error ? error.message : "经营数据格式不正确" };
  }
  if (!state.ponds.every(validPond)) return { valid: false, message: "塘口数据不完整或格式不正确" };
  const pondIds = new Set(state.ponds.map((pond) => pond.id));
  if (pondIds.size !== state.ponds.length) return { valid: false, message: "塘口 ID 存在重复" };
  if (!state.records.every((record) => validRecord(record, pondIds))) {
    return { valid: false, message: "记录数据不完整、数值越界或关联塘口不存在" };
  }
  if (new Set(state.records.map((record) => record.id)).size !== state.records.length) {
    return { valid: false, message: "记录 ID 存在重复" };
  }
  return { valid: true, message: "", state };
}
