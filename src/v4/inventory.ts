import { createId } from "../domain/id";
import type { InventoryKind, V4State, WeightUnit } from "./types";

function round(value: number, digits = 4): number {
  return Number(value.toFixed(digits));
}

export function convertWeightToKg(value: number, unit: WeightUnit): number {
  return unit === "jin" ? value / 2 : value;
}

export function purchaseInventory(
  state: V4State,
  input: {
    farmId: string;
    kind: InventoryKind;
    name: string;
    quantityKg: number;
    totalCostYuan: number;
    brand?: string;
    specification?: string;
    lotNumber?: string;
    expiresOn?: string;
  },
  actorId: string,
  now = new Date().toISOString()
): V4State {
  if (input.quantityKg <= 0 || input.totalCostYuan < 0) throw new Error("采购数量或金额不正确");
  const existing = state.inventory.find((item) =>
    item.farmId === input.farmId && item.kind === input.kind && item.name === input.name
  );
  const movementId = createId("stock-purchase");
  if (existing) {
    const totalQuantity = existing.quantityKg + input.quantityKg;
    const totalValue = existing.quantityKg * existing.averageUnitCostYuan + input.totalCostYuan;
    return {
      ...state,
      inventory: state.inventory.map((item) => item.id === existing.id ? {
        ...item,
        quantityKg: round(totalQuantity),
        averageUnitCostYuan: round(totalValue / totalQuantity),
        updatedAt: now
      } : item),
      inventoryMovements: [...state.inventoryMovements, {
        id: movementId,
        farmId: input.farmId,
        itemId: existing.id,
        type: "purchase",
        quantityKg: input.quantityKg,
        unitCostYuan: round(input.totalCostYuan / input.quantityKg),
        createdBy: actorId,
        createdAt: now
      }]
    };
  }
  const itemId = createId("stock");
  return {
    ...state,
    inventory: [...state.inventory, {
      id: itemId,
      farmId: input.farmId,
      kind: input.kind,
      name: input.name,
      ...(input.brand ? { brand: input.brand } : {}),
      ...(input.specification ? { specification: input.specification } : {}),
      ...(input.lotNumber ? { lotNumber: input.lotNumber } : {}),
      ...(input.expiresOn ? { expiresOn: input.expiresOn } : {}),
      quantityKg: input.quantityKg,
      averageUnitCostYuan: round(input.totalCostYuan / input.quantityKg),
      createdAt: now,
      updatedAt: now
    }],
    inventoryMovements: [...state.inventoryMovements, {
      id: movementId,
      farmId: input.farmId,
      itemId,
      type: "purchase",
      quantityKg: input.quantityKg,
      unitCostYuan: round(input.totalCostYuan / input.quantityKg),
      createdBy: actorId,
      createdAt: now
    }]
  };
}

export function consumeInventory(
  state: V4State,
  itemId: string,
  quantityKg: number,
  batchId: string,
  actorId: string,
  now = new Date().toISOString()
): V4State {
  const item = state.inventory.find((candidate) => candidate.id === itemId);
  if (!item) throw new Error("库存物料不存在");
  if (quantityKg <= 0 || item.quantityKg < quantityKg) throw new Error("库存不足");
  return {
    ...state,
    inventory: state.inventory.map((candidate) => candidate.id === itemId ? {
      ...candidate,
      quantityKg: round(candidate.quantityKg - quantityKg),
      updatedAt: now
    } : candidate),
    inventoryMovements: [...state.inventoryMovements, {
      id: createId("stock-consume"),
      farmId: item.farmId,
      itemId,
      batchId,
      type: "consume",
      quantityKg: -quantityKg,
      unitCostYuan: item.averageUnitCostYuan,
      createdBy: actorId,
      createdAt: now
    }]
  };
}
