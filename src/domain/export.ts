import type { FarmRecord, FarmState, Pond } from "../types";
import { validateFarmState } from "./state-validation";

export interface BackupPayload {
  exportedAt: string;
  app: "fishery-manager";
  formatVersion: 1;
  state: FarmState;
}

export interface ImportResult {
  valid: boolean;
  message: string;
  state?: FarmState;
}

export function createJsonBackup(state: FarmState, exportedAt = new Date().toISOString()): string {
  const payload: BackupPayload = {
    exportedAt,
    app: "fishery-manager",
    formatVersion: 1,
    state
  };
  return JSON.stringify(payload, null, 2);
}

function csvCell(value: string | number): string {
  const text = String(value);
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function recordValue(record: FarmRecord): string {
  if (record.type === "feed" || record.type === "harvest") {
    return `${record.weightKg}kg x ${record.unitPriceYuan}`;
  }
  if (record.type === "water") {
    return `pH ${record.ph}, DO ${record.dissolvedOxygen}, NH3 ${record.ammoniaNitrogen}`;
  }
  return `${record.drugName} ${record.dosage}, withdrawal ${record.withdrawalDays}d`;
}

function pondName(ponds: Pond[], pondId: string): string {
  return ponds.find((pond) => pond.id === pondId)?.name ?? pondId;
}

export function createRecordsCsv(state: FarmState): string {
  const rows = [
    ["日期", "塘口", "类型", "数值", "备注", "创建时间"],
    ...state.records.map((record) => [
      record.date,
      pondName(state.ponds, record.pondId),
      record.type,
      recordValue(record),
      record.note,
      record.createdAt
    ])
  ];
  return rows.map((row) => row.map(csvCell).join(",")).join("\n");
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parseJsonBackup(text: string): ImportResult {
  if (!text.trim()) {
    return { valid: false, message: "请先粘贴 JSON 备份内容" };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { valid: false, message: "JSON 格式不正确，请检查备份内容" };
  }

  if (!isObject(parsed)) {
    return { valid: false, message: "备份内容格式不正确" };
  }

  if (parsed.app !== "fishery-manager" || parsed.formatVersion !== 1) {
    return { valid: false, message: "不是当前小程序导出的备份" };
  }

  const validation = validateFarmState(parsed.state);
  if (!validation.valid || !validation.state) {
    return { valid: false, message: validation.message };
  }

  return { valid: true, message: "", state: validation.state };
}
