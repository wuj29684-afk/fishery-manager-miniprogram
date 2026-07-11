import type { DashboardMetric, FarmRecord, FarmState, Pond, PondDashboardSummary } from "../types";
import { formatMoney, todayString } from "./format";
import { evaluatePondHealth } from "./pond-health";

export function calculateRevenue(records: FarmRecord[]): number {
  return records.filter((item) => item.type === "harvest").reduce((sum, item) => sum + item.weightKg * item.unitPriceYuan, 0);
}

export function calculateFeedCost(records: FarmRecord[]): number {
  return records.filter((item) => item.type === "feed").reduce((sum, item) => sum + item.weightKg * item.unitPriceYuan, 0);
}

export function calculateTotalCost(records: FarmRecord[]): number {
  const drugCost = records.filter((item) => item.type === "drug").reduce((sum, item) => sum + (item.costYuan || 0), 0);
  const expenses = records.filter((item) => item.type === "expense").reduce((sum, item) => sum + item.amountYuan, 0);
  return calculateFeedCost(records) + drugCost + expenses;
}

export function calculateEstimatedProfit(records: FarmRecord[]): number {
  return calculateRevenue(records) - calculateTotalCost(records);
}

export function calculateSurvivalRate(pond: Pond, records: FarmRecord[]): number | null {
  if (!pond.stockingQuantity || pond.stockingQuantity <= 0) return null;
  const mortality = records.filter((item) => item.type === "mortality").reduce((sum, item) => sum + item.count, 0);
  return Math.max(0, ((pond.stockingQuantity - mortality) / pond.stockingQuantity) * 100);
}

export function calculateFcr(pond: Pond, records: FarmRecord[]): number | null {
  if (!pond.stockingQuantity || !pond.initialSize) return null;
  const initialWeightG = Number(pond.initialSize);
  const latestSample = records
    .filter((item) => item.type === "sampling")
    .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))[0];
  if (!Number.isFinite(initialWeightG) || initialWeightG <= 0 || !latestSample || latestSample.type !== "sampling") return null;
  const currentQuantity = latestSample.estimatedStockQuantity || pond.stockingQuantity;
  const gainKg = (currentQuantity * latestSample.averageWeightG - pond.stockingQuantity * initialWeightG) / 1000;
  if (gainKg <= 0) return null;
  const feedKg = records.filter((item) => item.type === "feed").reduce((sum, item) => sum + item.weightKg, 0);
  return feedKg / gainKg;
}

export function getRecordTitle(record: FarmRecord): string {
  if (record.type === "feed") return "投料 " + record.weightKg + "kg";
  if (record.type === "water") return "水质 pH " + record.ph;
  if (record.type === "drug") return "用药 " + record.drugName;
  if (record.type === "harvest") return "收获 " + record.weightKg + "kg";
  if (record.type === "sampling") return "抽样 " + record.averageWeightG + "g/尾";
  if (record.type === "mortality") return "死亡 " + record.count + " 尾";
  return "支出 " + record.itemName;
}

export function getCultureDays(pond: Pond, today = todayString()): number | null {
  if (!pond.stockingDate) return pond.legacyStockingDays ?? null;
  const start = Date.parse(pond.stockingDate + "T00:00:00.000Z");
  const end = Date.parse(today + "T00:00:00.000Z");
  return Number.isFinite(start) && end >= start ? Math.floor((end - start) / 86400000) + 1 : null;
}

export function getPondAlert(pond: Pond, state: FarmState, today = todayString()): string {
  return evaluatePondHealth(state, pond.id, today).alerts[0]?.message || "暂无预警";
}

export function getDashboardMetrics(state: FarmState, today = todayString()): DashboardMetric[] {
  const revenue = calculateRevenue(state.records);
  const profit = calculateEstimatedProfit(state.records);
  const todayCount = state.records.filter((item) => item.date === today).length;
  return [
    { label: "塘口", value: state.ponds.filter((pond) => pond.status === "active").length + " 个", tone: "good" },
    { label: "今日记录", value: todayCount + " 条", tone: todayCount > 0 ? "good" : "warn" },
    { label: "累计收入", value: formatMoney(revenue), tone: "good" },
    { label: "经营利润", value: state.records.length ? formatMoney(profit) : "暂无数据", tone: profit >= 0 ? "good" : "danger" }
  ];
}

export function getPondSummaries(state: FarmState): PondDashboardSummary[] {
  return [...state.ponds]
    .sort((a, b) => Number(a.status === "inactive") - Number(b.status === "inactive"))
    .map((pond) => {
      const records = state.records.filter((item) => item.pondId === pond.id);
      const alerts = evaluatePondHealth(state, pond.id, todayString()).alerts;
      const revenueYuan = calculateRevenue(records);
      const totalCostYuan = calculateTotalCost(records);
      return {
        pond,
        revenueYuan,
        feedCostYuan: calculateFeedCost(records),
        totalCostYuan,
        operatingProfitYuan: revenueYuan - totalCostYuan,
        recordCount: records.length,
        alert: alerts[0]?.message || "暂无预警",
        alertSeverity: alerts[0]?.severity || "none"
      };
    });
}

export function getRecentRecords(state: FarmState, limit = 5): FarmRecord[] {
  return [...state.records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
}
