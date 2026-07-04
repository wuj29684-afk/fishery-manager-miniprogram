import type { FarmRecord, FarmState, Pond, PondStatus, RecordType } from "../types";

export interface StateValidationResult {
  valid: boolean;
  message: string;
  state?: FarmState;
}

const recordTypes: RecordType[] = ["feed", "water", "drug", "harvest"];
const pondStatuses: PondStatus[] = ["active", "inactive"];

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeNumber(value: unknown): value is number {
  return isFiniteNumber(value) && value >= 0;
}

function isIsoDateTime(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function isDateString(value: unknown): value is string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year && parsed.getUTCMonth() === month - 1 && parsed.getUTCDate() === day;
}

function fail(message: string): StateValidationResult {
  return { valid: false, message };
}

function validatePond(value: unknown): value is Pond {
  if (!isObject(value)) return false;
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.name) &&
    isNonEmptyString(value.species) &&
    isNonEmptyString(value.location) &&
    isNonNegativeNumber(value.areaMu) &&
    isNonNegativeNumber(value.day) &&
    pondStatuses.includes(value.status as PondStatus) &&
    isIsoDateTime(value.createdAt) &&
    isIsoDateTime(value.updatedAt)
  );
}

function validateRecordBase(value: Record<string, unknown>, pondIds: Set<string>): boolean {
  return (
    isNonEmptyString(value.id) &&
    isNonEmptyString(value.pondId) &&
    pondIds.has(value.pondId) &&
    recordTypes.includes(value.type as RecordType) &&
    isDateString(value.date) &&
    typeof value.note === "string" &&
    isIsoDateTime(value.createdAt)
  );
}

function validateRecord(value: unknown, pondIds: Set<string>): value is FarmRecord {
  if (!isObject(value) || !validateRecordBase(value, pondIds)) return false;

  if (value.type === "feed" || value.type === "harvest") {
    return isNonNegativeNumber(value.weightKg) && isNonNegativeNumber(value.unitPriceYuan);
  }

  if (value.type === "water") {
    return (
      isFiniteNumber(value.ph) &&
      value.ph >= 0 &&
      value.ph <= 14 &&
      isNonNegativeNumber(value.dissolvedOxygen) &&
      isNonNegativeNumber(value.ammoniaNitrogen)
    );
  }

  if (value.type === "drug") {
    return isNonEmptyString(value.drugName) && isNonEmptyString(value.dosage) && isNonNegativeNumber(value.withdrawalDays);
  }

  return false;
}

export function validateFarmState(value: unknown): StateValidationResult {
  if (!isObject(value) || value.version !== 1 || !Array.isArray(value.ponds) || !Array.isArray(value.records)) {
    return fail("备份缺少塘口或记录数据");
  }

  const ponds = value.ponds;
  const records = value.records;

  if (!ponds.every(validatePond)) {
    return fail("备份中的塘口数据不完整或格式不正确");
  }

  const pondIds = new Set(ponds.map((pond) => pond.id));
  if (pondIds.size !== ponds.length) {
    return fail("备份中的塘口 ID 存在重复");
  }

  if (!records.every((record) => validateRecord(record, pondIds))) {
    return fail("备份中的记录数据不完整、数值越界或关联了不存在的塘口");
  }

  const recordIds = new Set(records.map((record) => record.id));
  if (recordIds.size !== records.length) {
    return fail("备份中的记录 ID 存在重复");
  }

  return {
    valid: true,
    message: "",
    state: {
      version: 1,
      ponds,
      records
    }
  };
}
