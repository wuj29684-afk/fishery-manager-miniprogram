import type { Pond, RecordType } from "../types";

export interface ValidationResult {
  valid: boolean;
  message: string;
}

export interface NumberValidationResult extends ValidationResult {
  value: number;
}

export function validateNumberRange(value: number, label: string, min = 0, max = Number.POSITIVE_INFINITY): ValidationResult {
  if (!Number.isFinite(value) || value < min || value > max) {
    const rangeText = Number.isFinite(max) ? `${min} 到 ${max}` : `不小于 ${min}`;
    return { valid: false, message: `${label}需要填写为${rangeText}的数字` };
  }
  return { valid: true, message: "" };
}

export function validatePositiveNumber(value: number, label: string): ValidationResult {
  return validateNumberRange(value, label, 0);
}

export function parseRequiredNumber(value: string, label: string, min = 0, max = Number.POSITIVE_INFINITY): NumberValidationResult {
  if (!value.trim()) {
    return { valid: false, message: `请填写${label}`, value: 0 };
  }

  const parsed = Number(value);
  const range = validateNumberRange(parsed, label, min, max);
  return { ...range, value: parsed };
}

export function validatePondInput(input: Pick<Pond, "name" | "species" | "location" | "areaMu" | "day">): ValidationResult {
  if (!input.name.trim()) return { valid: false, message: "请填写塘口名称" };
  if (!input.species.trim()) return { valid: false, message: "请填写养殖品种" };
  const area = validatePositiveNumber(input.areaMu, "面积");
  if (!area.valid) return area;
  const day = validatePositiveNumber(input.day, "入塘天数");
  if (!day.valid) return day;
  return { valid: true, message: "" };
}

export function labelForRecordType(type: RecordType): string {
  const labels: Record<RecordType, string> = {
    feed: "投料",
    water: "水质",
    drug: "用药",
    harvest: "收获"
  };
  return labels[type];
}
