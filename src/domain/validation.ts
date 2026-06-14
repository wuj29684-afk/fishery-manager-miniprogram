import type { Pond, RecordType } from "../types";

export interface ValidationResult {
  valid: boolean;
  message: string;
}

export function validatePositiveNumber(value: number, label: string): ValidationResult {
  if (!Number.isFinite(value) || value < 0) {
    return { valid: false, message: `${label}需要填写为不小于 0 的数字` };
  }
  return { valid: true, message: "" };
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
