import type { V4State } from "./types";

export interface CalculatedMetric {
  value: number | null;
  missingReason: string;
}

export interface BatchMetrics {
  feedKg: number;
  estimatedStockQuantity: number | null;
  survivalRate: number | null;
  revenueYuan: number;
  directCostYuan: number;
  allocatedCostYuan: number;
  profitYuan: number | null;
  fcr: CalculatedMetric;
}

function number(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function calculateBatchMetrics(state: V4State, batchId: string): BatchMetrics {
  const batch = state.batches.find((item) => item.id === batchId);
  if (!batch) throw new Error("养殖批次不存在");
  const records = state.records.filter((record) => record.batchId === batchId);
  const feedKg = records.filter((record) => record.type === "feed")
    .reduce((sum, record) => sum + number(record.data.weightKg), 0);
  const latestSampling = records.filter((record) => record.type === "sampling")
    .sort((a, b) => b.date.localeCompare(a.date))[0];
  const estimatedStockQuantity = latestSampling
    ? number(latestSampling.data.estimatedStockQuantity) || null
    : null;
  const survivalRate = batch.stockingQuantity && estimatedStockQuantity !== null
    ? Number(((estimatedStockQuantity / batch.stockingQuantity) * 100).toFixed(2))
    : null;
  const revenueYuan = records.filter((record) => record.type === "harvest")
    .reduce((sum, record) => sum + number(record.data.weightKg) * number(record.data.unitPriceYuan), 0);
  const recordCost = records.reduce((sum, record) => {
    if (record.type === "feed") return sum + number(record.data.weightKg) * number(record.data.unitCostYuan);
    if (record.type === "drug") return sum + number(record.data.costYuan);
    if (record.type === "expense") return sum + number(record.data.amountYuan);
    return sum;
  }, 0);
  const movementCost = state.inventoryMovements
    .filter((movement) => movement.batchId === batchId && movement.type === "consume")
    .reduce((sum, movement) => sum + Math.abs(movement.quantityKg) * movement.unitCostYuan, 0);
  const directCostYuan = Number(Math.max(recordCost, movementCost).toFixed(2));
  const allocatedCostYuan = records.filter((record) => record.type === "expense" && record.data.allocation === "shared")
    .reduce((sum, record) => sum + number(record.data.allocatedAmountYuan), 0);
  const profitYuan = revenueYuan || directCostYuan || allocatedCostYuan
    ? Number((revenueYuan - directCostYuan - allocatedCostYuan).toFixed(2))
    : null;
  const validBiomassSamples = records.filter((record) =>
    record.type === "sampling" &&
    number(record.data.averageWeightG) > 0 &&
    number(record.data.estimatedStockQuantity) > 0
  );
  const fcr: CalculatedMetric = validBiomassSamples.length < 2
    ? { value: null, missingReason: "至少需要两次有效生物量抽样" }
    : (() => {
      const ordered = [...validBiomassSamples].sort((a, b) => a.date.localeCompare(b.date));
      const first = ordered[0];
      const last = ordered[ordered.length - 1];
      const gainKg = (
        number(last.data.averageWeightG) * number(last.data.estimatedStockQuantity) -
        number(first.data.averageWeightG) * number(first.data.estimatedStockQuantity)
      ) / 1000;
      return gainKg > 0
        ? { value: Number((feedKg / gainKg).toFixed(3)), missingReason: "" }
        : { value: null, missingReason: "生物量增重不足，无法计算" };
    })();
  return {
    feedKg: Number(feedKg.toFixed(3)),
    estimatedStockQuantity,
    survivalRate,
    revenueYuan: Number(revenueYuan.toFixed(2)),
    directCostYuan,
    allocatedCostYuan: Number(allocatedCostYuan.toFixed(2)),
    profitYuan,
    fcr
  };
}

export function allocateSharedExpense(
  amountYuan: number,
  targets: Array<{ batchId: string; weight: number }>
): Array<{ batchId: string; amountYuan: number }> {
  const valid = targets.filter((target) => target.weight > 0);
  const totalWeight = valid.reduce((sum, target) => sum + target.weight, 0);
  if (amountYuan < 0 || totalWeight <= 0) throw new Error("分摊金额或权重不正确");
  let assigned = 0;
  return valid.map((target, index) => {
    const amount = index === valid.length - 1
      ? Number((amountYuan - assigned).toFixed(2))
      : Number((amountYuan * target.weight / totalWeight).toFixed(2));
    assigned += amount;
    return { batchId: target.batchId, amountYuan: amount };
  });
}

