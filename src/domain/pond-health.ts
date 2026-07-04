import type { FarmRecord, FarmState } from "../types";

export type PondAlertCode =
  | "LOW_OXYGEN"
  | "PH_OUT_OF_RANGE"
  | "HIGH_AMMONIA"
  | "MISSING_FEED_RECORD"
  | "MISSING_WATER_RECORD";

export interface PondAlert {
  code: PondAlertCode;
  severity: "low" | "medium" | "high";
  message: string;
}

export interface PondHealthResult {
  alerts: PondAlert[];
}

const dayMs = 24 * 60 * 60 * 1000;

export function evaluatePondHealth(state: FarmState, pondId: string, today: string): PondHealthResult {
  const records = state.records.filter((record) => record.pondId === pondId);
  const waterRecords = records.filter((record) => record.type === "water");
  const feedRecords = records.filter((record) => record.type === "feed");
  const latestWater = latestRecord(waterRecords);
  const alerts: PondAlert[] = [];

  if (latestWater?.type === "water") {
    if (latestWater.dissolvedOxygen < 3) {
      alerts.push({
        code: "LOW_OXYGEN",
        severity: "high",
        message: `溶氧 ${latestWater.dissolvedOxygen} mg/L 偏低，请优先增氧并复测。`
      });
    }

    if (latestWater.ph < 6.5 || latestWater.ph > 8.5) {
      alerts.push({
        code: "PH_OUT_OF_RANGE",
        severity: "medium",
        message: `pH ${latestWater.ph} 超出建议范围，请复测并观察鱼虾状态。`
      });
    }

    if (latestWater.ammoniaNitrogen > 0.5) {
      alerts.push({
        code: "HIGH_AMMONIA",
        severity: "high",
        message: `氨氮 ${latestWater.ammoniaNitrogen} 偏高，请检查水质和投喂量。`
      });
    }
  }

  if (!hasRecordWithinDays(feedRecords, today, 2)) {
    alerts.push({
      code: "MISSING_FEED_RECORD",
      severity: "medium",
      message: "近 2 天没有投料记录，请确认是否漏记。"
    });
  }

  if (!hasRecordWithinDays(waterRecords, today, 2)) {
    alerts.push({
      code: "MISSING_WATER_RECORD",
      severity: "medium",
      message: "近 2 天没有水质记录，请补充检测。"
    });
  }

  return { alerts };
}

function latestRecord<T extends FarmRecord>(records: T[]): T | undefined {
  return [...records].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt))[0];
}

function hasRecordWithinDays(records: Array<{ date: string }>, today: string, days: number): boolean {
  const todayTime = Date.parse(`${today}T00:00:00.000Z`);
  return records.some((record) => {
    const recordTime = Date.parse(`${record.date}T00:00:00.000Z`);
    return Number.isFinite(recordTime) && todayTime >= recordTime && todayTime - recordTime <= days * dayMs;
  });
}
