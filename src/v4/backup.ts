import CryptoJS from "crypto-js";
import { createRecordsCsv, createReportLines } from "./report";
import type { V4State } from "./types";

const BACKUP_PREFIX = "FISHERY-MANAGER-V4:";

export interface CompleteBackupPackage {
  formatVersion: 1;
  exportedAt: string;
  state: V4State;
  files: {
    recordsCsv: string;
    inventoryCsv: string;
    membersCsv: string;
    reports: string[];
    photoCloudFileIds: string[];
  };
  checksum: string;
  restoreInstructions: string;
}

function csv(rows: unknown[][]): string {
  return rows.map((row) => row.map((value) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`).join(",")).join("\n");
}

export function createCompleteBackupPackage(state: V4State): CompleteBackupPackage {
  const files = {
    recordsCsv: createRecordsCsv(state),
    inventoryCsv: csv([["id", "kind", "name", "quantityKg", "averageUnitCostYuan"], ...state.inventory.map((item) => [item.id, item.kind, item.name, item.quantityKg, item.averageUnitCostYuan])]),
    membersCsv: csv([["id", "farmId", "role", "unitIds", "canViewFinance", "status"], ...state.members.map((item) => [item.id, item.farmId, item.role, item.unitIds.join("|"), item.canViewFinance, item.status])]),
    reports: (["daily", "weekly", "batch"] as const).map((kind) => createReportLines(state, kind).join("\n")),
    photoCloudFileIds: Array.from(new Set(state.records.flatMap((record) => record.photos)))
  };
  const exportedAt = new Date().toISOString();
  const checksum = CryptoJS.SHA256(JSON.stringify({ state, files, exportedAt })).toString();
  return {
    formatVersion: 1,
    exportedAt,
    state,
    files,
    checksum,
    restoreInstructions: "使用渔儿小助手 0.4.0 或更高版本，输入原备份密码后预检并恢复。照片字段保存 CloudBase 文件引用。"
  };
}

export function createCompleteEncryptedBackup(state: V4State, password: string): string {
  if (password.length < 4) throw new Error("备份密码至少 4 位");
  return BACKUP_PREFIX + CryptoJS.AES.encrypt(JSON.stringify(createCompleteBackupPackage(state)), password).toString();
}

export function createEncryptedBackup(state: V4State, password: string): string {
  if (password.length < 4) throw new Error("备份密码至少 4 位");
  return BACKUP_PREFIX + CryptoJS.AES.encrypt(JSON.stringify(state), password).toString();
}

export function parseEncryptedBackup(value: string, password: string): V4State {
  if (!value.startsWith(BACKUP_PREFIX)) throw new Error("不是 0.4 加密备份");
  try {
    const bytes = CryptoJS.AES.decrypt(value.slice(BACKUP_PREFIX.length), password);
    const text = bytes.toString(CryptoJS.enc.Utf8);
    if (!text) throw new Error("备份密码不正确");
    const parsed = JSON.parse(text) as V4State | CompleteBackupPackage;
    const state = "formatVersion" in parsed ? parsed.state : parsed;
    if ("formatVersion" in parsed) {
      const expected = CryptoJS.SHA256(JSON.stringify({ state: parsed.state, files: parsed.files, exportedAt: parsed.exportedAt })).toString();
      if (expected !== parsed.checksum) throw new Error("备份校验失败");
    }
    if (state.version !== 3 || !Array.isArray(state.farms) || !Array.isArray(state.records)) {
      throw new Error("备份数据格式不正确");
    }
    return state;
  } catch (error) {
    if (error instanceof Error && /备份|密码/.test(error.message)) throw error;
    throw new Error("备份密码不正确或文件已损坏");
  }
}
