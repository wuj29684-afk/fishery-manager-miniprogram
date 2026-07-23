import type { FarmUnitType, RecordType } from "../types";

export interface ValidationResult { valid: boolean; message: string; }
export interface NumberValidationResult extends ValidationResult { value: number; }

export function validateNumberRange(value: number, label: string, min = 0, max = Number.POSITIVE_INFINITY): ValidationResult {
  if (!Number.isFinite(value) || value < min || value > max) {
    return { valid: false, message: label + "需要填写为" + min + "到" + (Number.isFinite(max) ? max : "更大") + "的数字" };
  }
  return { valid: true, message: "" };
}

export function validatePositiveNumber(value: number, label: string): ValidationResult {
  return validateNumberRange(value, label, 0.000001);
}

export function parseRequiredNumber(value: string, label: string, min = 0, max = Number.POSITIVE_INFINITY): NumberValidationResult {
  if (!value.trim()) return { valid: false, message: "请填写" + label, value: 0 };
  const parsed = Number(value);
  return { ...validateNumberRange(parsed, label, min, max), value: parsed };
}

export function parseOptionalNumber(value: string, label: string, min = 0, max = Number.POSITIVE_INFINITY): NumberValidationResult {
  if (!value.trim()) return { valid: true, message: "", value: Number.NaN };
  const parsed = Number(value);
  return { ...validateNumberRange(parsed, label, min, max), value: parsed };
}

export function validatePondInput(input: { unitType: FarmUnitType; name: string; species: string; location: string; areaMu: number; cageLengthM?: number; cageWidthM?: number; cageDepthM?: number; stockingDate?: string }): ValidationResult {
  if (!input.name.trim()) return { valid: false, message: "请填写养殖单元名称" };
  if (!input.species.trim()) return { valid: false, message: "请填写养殖品种" };
  if (!input.stockingDate) return { valid: false, message: "请选择投放日期" };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.stockingDate)) return { valid: false, message: "投放日期格式不正确" };
  if (input.areaMu < 0) return { valid: false, message: "面积不能小于 0" };
  const dimensions = [input.cageLengthM, input.cageWidthM, input.cageDepthM].filter((value) => value !== undefined);
  if (dimensions.some((value) => !Number.isFinite(value) || (value || 0) <= 0)) return { valid: false, message: "网箱尺寸请填写有效数字" };
  return { valid: true, message: "" };
}

export function labelForRecordType(type: RecordType): string {
  return ({ feed: "投料", water: "水质", drug: "用药", harvest: "收获", sampling: "抽样", mortality: "死亡", expense: "经营支出" } as Record<RecordType, string>)[type];
}
