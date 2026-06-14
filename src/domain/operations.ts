import type { DashboardMetric, FarmRecord, FarmState, Pond, PondDashboardSummary } from "../types";
import { formatMoney, todayString } from "./format";

function recordAmount(record: FarmRecord): number {
  if (record.type === "feed" || record.type === "harvest") {
    return record.weightKg * record.unitPriceYuan;
  }
  return 0;
}

export function calculateRevenue(records: FarmRecord[]): number {
  return records.filter((item) => item.type === "harvest").reduce((sum, item) => sum + recordAmount(item), 0);
}

export function calculateFeedCost(records: FarmRecord[]): number {
  return records.filter((item) => item.type === "feed").reduce((sum, item) => sum + recordAmount(item), 0);
}

export function calculateEstimatedProfit(records: FarmRecord[]): number {
  return calculateRevenue(records) - calculateFeedCost(records);
}

export function getRecordTitle(record: FarmRecord): string {
  if (record.type === "feed") return `投料 ${record.weightKg}kg`;
  if (record.type === "water") return `水质 pH ${record.ph}`;
  if (record.type === "drug") return `用药 ${record.drugName}`;
  return `收获 ${record.weightKg}kg`;
}

export function getPondAlert(pond: Pond, records: FarmRecord[]): string {
  const pondRecords = records.filter((item) => item.pondId === pond.id);
  const latestWater = [...pondRecords].reverse().find((item) => item.type === "water");
  if (latestWater?.type === "water") {
    if (latestWater.ph > 8.5 || latestWater.ph < 6.5) return "pH 异常，建议复测水质";
    if (latestWater.dissolvedOxygen < 4) return "溶氧偏低，建议增氧";
    if (latestWater.ammoniaNitrogen > 0.5) return "氨氮偏高，建议换水或改底";
  }
  const drugRecord = pondRecords.find((item) => item.type === "drug" && item.withdrawalDays > 0);
  if (drugRecord) return "存在休药期记录，出鱼前请复核";
  return "状态平稳";
}

export function getDashboardMetrics(state: FarmState, today = todayString()): DashboardMetric[] {
  const revenue = calculateRevenue(state.records);
  const profit = calculateEstimatedProfit(state.records);
  const todayCount = state.records.filter((item) => item.date === today).length;
  const activePondCount = state.ponds.filter((pond) => pond.status !== "inactive").length;
  return [
    { label: "塘口", value: `${activePondCount} 个`, tone: "good" },
    { label: "今日记录", value: `${todayCount} 条`, tone: todayCount > 0 ? "good" : "warn" },
    { label: "累计收入", value: formatMoney(revenue), tone: "good" },
    { label: "估算利润", value: formatMoney(profit), tone: profit >= 0 ? "good" : "danger" }
  ];
}

export function getPondSummaries(state: FarmState): PondDashboardSummary[] {
  return [...state.ponds].sort((a, b) => Number(a.status === "inactive") - Number(b.status === "inactive")).map((pond) => {
    const records = state.records.filter((item) => item.pondId === pond.id);
    const revenueYuan = calculateRevenue(records);
    const feedCostYuan = calculateFeedCost(records);
    return {
      pond,
      revenueYuan,
      feedCostYuan,
      estimatedProfitYuan: revenueYuan - feedCostYuan,
      recordCount: records.length,
      alert: getPondAlert(pond, state.records)
    };
  });
}

export function getRecentRecords(state: FarmState, limit = 5): FarmRecord[] {
  return [...state.records].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, limit);
}
