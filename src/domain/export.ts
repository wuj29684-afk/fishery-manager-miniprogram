import { validateFarmState } from "./state-validation";
import type { FarmRecord, FarmState } from "../types";

export interface ImportResult {
  valid: boolean;
  message: string;
  state?: FarmState;
}

export function createJsonBackup(state: FarmState, exportedAt = new Date().toISOString()): string {
  return JSON.stringify({ exportedAt, app: "fishery-manager", formatVersion: 2, state }, null, 2);
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
}

function recordValue(record: FarmRecord): string {
  if (record.type === "feed") return record.weightKg + "kg x " + record.unitPriceYuan;
  if (record.type === "water") return "pH " + record.ph + ", DO " + record.dissolvedOxygen + ", NH3 " + record.ammoniaNitrogen;
  if (record.type === "drug") return record.drugName + " " + record.dosage + ", 休药至 " + record.withdrawalEndDate;
  if (record.type === "harvest") return record.weightKg + "kg x " + record.unitPriceYuan;
  if (record.type === "sampling") return record.sampleCount + "尾, " + record.averageWeightG + "g/尾";
  if (record.type === "mortality") return record.count + "尾";
  return record.itemName + " " + record.amountYuan + "元";
}

const typeLabels: Record<FarmRecord["type"], string> = {
  feed: "投料",
  water: "水质",
  drug: "用药",
  harvest: "收获",
  sampling: "抽样",
  mortality: "死亡",
  expense: "经营支出"
};

export function createRecordsCsv(state: FarmState): string {
  const rows = [
    ["日期", "塘口", "类型", "核心数值", "备注", "创建时间", "更新时间"],
    ...state.records.map((record) => [
      record.date,
      state.ponds.find((pond) => pond.id === record.pondId)?.name || record.pondId,
      typeLabels[record.type],
      recordValue(record),
      record.note,
      record.createdAt,
      record.updatedAt
    ])
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

export function parseJsonBackup(text: string): ImportResult {
  if (!text.trim()) return { valid: false, message: "请先粘贴 JSON 备份内容" };
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { valid: false, message: "JSON 格式不正确，请检查备份内容" };
  }
  if (!parsed || typeof parsed !== "object") return { valid: false, message: "备份内容格式不正确" };
  const payload = parsed as { app?: string; formatVersion?: number; state?: unknown };
  if (payload.app !== "fishery-manager" || ![1, 2].includes(payload.formatVersion || 0)) {
    return { valid: false, message: "不是当前小程序导出的备份" };
  }
  return validateFarmState(payload.state);
}
