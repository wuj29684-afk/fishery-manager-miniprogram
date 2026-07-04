import type { FarmState } from "../types";
import { evaluatePondHealth } from "./pond-health";

export interface WeeklyReport {
  pondId: string;
  startDate: string;
  endDate: string;
  feedWeightKg: number;
  waterRecordCount: number;
  drugRecordCount: number;
  harvestWeightKg: number;
  harvestRevenueYuan: number;
  alertCount: number;
}

const dayMs = 24 * 60 * 60 * 1000;

export function buildWeeklyReport(state: FarmState, pondId: string, endDate: string): WeeklyReport {
  const endTime = Date.parse(`${endDate}T00:00:00.000Z`);
  const startDate = new Date(endTime - 6 * dayMs).toISOString().slice(0, 10);
  const records = state.records.filter((record) => record.pondId === pondId && record.date >= startDate && record.date <= endDate);
  const feedRecords = records.filter((record) => record.type === "feed");
  const waterRecords = records.filter((record) => record.type === "water");
  const drugRecords = records.filter((record) => record.type === "drug");
  const harvestRecords = records.filter((record) => record.type === "harvest");

  return {
    pondId,
    startDate,
    endDate,
    feedWeightKg: feedRecords.reduce((sum, record) => sum + record.weightKg, 0),
    waterRecordCount: waterRecords.length,
    drugRecordCount: drugRecords.length,
    harvestWeightKg: harvestRecords.reduce((sum, record) => sum + record.weightKg, 0),
    harvestRevenueYuan: harvestRecords.reduce((sum, record) => sum + record.weightKg * record.unitPriceYuan, 0),
    alertCount: evaluatePondHealth(state, pondId, endDate).alerts.length
  };
}
