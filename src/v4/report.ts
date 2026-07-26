import { calculateBatchMetrics } from "./metrics";
import { addLocalDays, formatLocalDate } from "./date";
import type { V4State } from "./types";

export type ReportKind = "daily" | "weekly" | "batch";

export function createReportLines(state: V4State, kind: ReportKind, batchId = ""): string[] {
  const today = formatLocalDate();
  const weekStart = addLocalDays(new Date(), -6);
  const batch = state.batches.find((item) => item.id === batchId) ||
    state.batches.find((item) => item.unitId === state.settings.selectedUnitId && item.status !== "completed");
  const farm = state.farms.find((item) => item.id === (batch?.farmId || state.settings.selectedFarmId));
  const title = kind === "daily" ? "今日值班记录" : kind === "weekly" ? "本周养殖简报" : "批次结算报告";
  const records = state.records.filter((record) => {
    if (batch && record.batchId !== batch.id) return false;
    if (kind === "daily") return record.date === today;
    if (kind === "weekly") {
      return record.date >= weekStart && record.date <= today;
    }
    return true;
  });
  const lines = [title, farm?.name || "养殖场", `生成时间：${new Date().toLocaleString()}`, `记录数量：${records.length}`];
  if (batch) {
    const metrics = calculateBatchMetrics(state, batch.id);
    lines.push(`品种：${batch.species}`, `累计投喂：${metrics.feedKg} kg`);
    lines.push(`估算存塘：${metrics.estimatedStockQuantity === null ? "数据不足" : `${metrics.estimatedStockQuantity} 尾`}`);
    lines.push(`成活率：${metrics.survivalRate === null ? "数据不足" : `${metrics.survivalRate}%`}`);
    lines.push(`饵料系数：${metrics.fcr.value === null ? metrics.fcr.missingReason : metrics.fcr.value}`);
    lines.push(`收入：¥${metrics.revenueYuan}`, `直接成本：¥${metrics.directCostYuan}`);
  }
  records.slice(0, 20).forEach((record) => lines.push(`${record.date} · ${record.type} · ${record.note || "无备注"}`));
  lines.push("数据由用户记录，仅供养殖管理参考");
  return lines;
}

export function createRecordsCsv(state: V4State): string {
  const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, "\"\"")}"`;
  return [
    ["id", "farmId", "unitId", "batchId", "type", "date", "note", "createdBy"].join(","),
    ...state.records.map((record) => [
      record.id, record.farmId, record.unitId, record.batchId, record.type, record.date, record.note, record.createdBy
    ].map(quote).join(","))
  ].join("\n");
}
