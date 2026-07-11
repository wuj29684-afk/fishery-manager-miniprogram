import { thresholdsForPond } from "./alert-profiles";
import { hasActiveWithdrawal } from "./withdrawal";
import type { AlertSeverity, FarmRecord, FarmState } from "../types";

export type PondAlertCode =
  | "LOW_OXYGEN"
  | "PH_OUT_OF_RANGE"
  | "HIGH_AMMONIA"
  | "HIGH_NITRITE"
  | "TEMPERATURE_OUT_OF_RANGE"
  | "SALINITY_OUT_OF_RANGE"
  | "ACTIVE_WITHDRAWAL"
  | "MISSING_FEED_RECORD"
  | "MISSING_WATER_RECORD";

export interface PondAlert {
  code: PondAlertCode;
  severity: AlertSeverity;
  category: "risk" | "task";
  message: string;
}

const dayMs = 86400000;
const severityOrder = { high: 0, medium: 1, low: 2 };

export function evaluatePondHealth(state: FarmState, pondId: string, today: string): { alerts: PondAlert[] } {
  const pond = state.ponds.find((item) => item.id === pondId);
  if (!pond) return { alerts: [] };
  const records = state.records.filter((record) => record.pondId === pondId);
  const waterRecords = records.filter((record) => record.type === "water");
  const feedRecords = records.filter((record) => record.type === "feed");
  const latestWater = latestRecord(waterRecords);
  const thresholds = thresholdsForPond(pond);
  const alerts: PondAlert[] = [];

  if (latestWater?.type === "water") {
    if (latestWater.dissolvedOxygen < thresholds.dissolvedOxygenMin) {
      alerts.push({ code: "LOW_OXYGEN", severity: "high", category: "risk", message: "溶氧偏低，请优先增氧并复测。" });
    }
    if (latestWater.ph < thresholds.phMin || latestWater.ph > thresholds.phMax) {
      alerts.push({ code: "PH_OUT_OF_RANGE", severity: "medium", category: "risk", message: "pH 超出当前塘口参考范围，请复测。" });
    }
    if (latestWater.ammoniaNitrogen > thresholds.ammoniaNitrogenMax) {
      alerts.push({ code: "HIGH_AMMONIA", severity: "high", category: "risk", message: "氨氮偏高，请检查投喂和底质。" });
    }
    if (latestWater.nitrite !== undefined && thresholds.nitriteMax !== undefined && latestWater.nitrite > thresholds.nitriteMax) {
      alerts.push({ code: "HIGH_NITRITE", severity: "high", category: "risk", message: "亚硝酸盐偏高，请复测并及时处理。" });
    }
    if (
      latestWater.temperature !== undefined &&
      ((thresholds.temperatureMin !== undefined && latestWater.temperature < thresholds.temperatureMin) ||
        (thresholds.temperatureMax !== undefined && latestWater.temperature > thresholds.temperatureMax))
    ) {
      alerts.push({ code: "TEMPERATURE_OUT_OF_RANGE", severity: "medium", category: "risk", message: "水温超出当前品种参考范围。" });
    }
    if (
      latestWater.salinity !== undefined &&
      ((thresholds.salinityMin !== undefined && latestWater.salinity < thresholds.salinityMin) ||
        (thresholds.salinityMax !== undefined && latestWater.salinity > thresholds.salinityMax))
    ) {
      alerts.push({ code: "SALINITY_OUT_OF_RANGE", severity: "medium", category: "risk", message: "盐度超出当前塘口参考范围。" });
    }
  }

  if (hasActiveWithdrawal(records, today)) {
    alerts.push({ code: "ACTIVE_WITHDRAWAL", severity: "high", category: "risk", message: "当前仍在休药期，收获前请核对。" });
  }
  if (!hasRecordWithinDays(feedRecords, today, 2)) {
    alerts.push({ code: "MISSING_FEED_RECORD", severity: "low", category: "task", message: "近 2 天没有投料记录，请确认是否漏记。" });
  }
  if (!hasRecordWithinDays(waterRecords, today, 2)) {
    alerts.push({ code: "MISSING_WATER_RECORD", severity: "low", category: "task", message: "近 2 天没有水质记录，请补充检测。" });
  }
  return { alerts: alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]) };
}

function latestRecord<T extends FarmRecord>(records: T[]): T | undefined {
  return [...records].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt))[0];
}

function hasRecordWithinDays(records: Array<{ date: string }>, today: string, days: number): boolean {
  const todayTime = Date.parse(today + "T00:00:00.000Z");
  return records.some((record) => {
    const recordTime = Date.parse(record.date + "T00:00:00.000Z");
    return Number.isFinite(recordTime) && todayTime >= recordTime && todayTime - recordTime <= days * dayMs;
  });
}
