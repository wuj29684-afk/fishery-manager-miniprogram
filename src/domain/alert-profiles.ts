import type { AlertProfileId, FarmUnitType, Pond, WaterThresholds } from "../types";

export const alertProfiles: Record<AlertProfileId, { name: string; thresholds: WaterThresholds }> = {
  shrimp: {
    name: "南美白对虾参考",
    thresholds: {
      phMin: 7.5,
      phMax: 8.8,
      dissolvedOxygenMin: 4,
      ammoniaNitrogenMax: 0.3,
      nitriteMax: 0.2,
      temperatureMin: 24,
      temperatureMax: 32,
      salinityMin: 5,
      salinityMax: 35
    }
  },
  tilapia: {
    name: "罗非鱼参考",
    thresholds: {
      phMin: 6.5,
      phMax: 8.5,
      dissolvedOxygenMin: 3,
      ammoniaNitrogenMax: 0.5,
      nitriteMax: 0.2,
      temperatureMin: 20,
      temperatureMax: 34
    }
  },
  cageFish: {
    name: "网箱鱼类参考",
    thresholds: {
      phMin: 6.5,
      phMax: 8.5,
      dissolvedOxygenMin: 5,
      ammoniaNitrogenMax: 0.3,
      nitriteMax: 0.2,
      temperatureMin: 18,
      temperatureMax: 32
    }
  },
  general: {
    name: "通用养殖参考",
    thresholds: {
      phMin: 6.5,
      phMax: 8.5,
      dissolvedOxygenMin: 4,
      ammoniaNitrogenMax: 0.5,
      nitriteMax: 0.2
    }
  }
};

export function inferAlertProfile(species: string, unitType: FarmUnitType = "pond"): AlertProfileId {
  if (/虾|shrimp/i.test(species)) return "shrimp";
  if (/罗非|tilapia/i.test(species)) return "tilapia";
  if (unitType === "cage") return "cageFish";
  return "general";
}

export function thresholdsForPond(pond: Pond): WaterThresholds {
  return {
    ...alertProfiles[pond.alertProfileId].thresholds,
    ...pond.customThresholds
  };
}
