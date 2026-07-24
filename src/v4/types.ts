export type WeightUnit = "jin" | "kg";
export type FarmStatus = "active" | "inactive";
export type UnitType = "pond" | "cage" | "tank" | "other";
export type UnitStatus = "active" | "inactive";
export type BatchStatus = "preparing" | "culturing" | "completed";
export type V4RecordType =
  | "feed"
  | "water"
  | "drug"
  | "patrol"
  | "sampling"
  | "mortality"
  | "harvest"
  | "expense"
  | "custom";
export type InventoryKind = "feed" | "drug";
export type MemberRole = "owner" | "recorder";
export type MemberStatus = "active" | "paused";
export type SyncState = "local" | "pending" | "synced" | "conflict" | "error";

export interface V4Farm {
  id: string;
  name: string;
  ownerUserId: string;
  province: string;
  city: string;
  district: string;
  status: FarmStatus;
  createdAt: string;
  updatedAt: string;
}

export interface V4Member {
  id: string;
  farmId: string;
  userId: string;
  displayName: string;
  role: MemberRole;
  unitIds: string[];
  canViewFinance: boolean;
  status: MemberStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface V4Unit {
  id: string;
  farmId: string;
  type: UnitType;
  name: string;
  location: string;
  areaMu?: number;
  lengthM?: number;
  widthM?: number;
  depthM?: number;
  effectiveVolumeM3?: number;
  status: UnitStatus;
  createdAt: string;
  updatedAt: string;
}

export interface V4Batch {
  id: string;
  farmId: string;
  unitId: string;
  species: string;
  status: BatchStatus;
  stockingDate?: string;
  stockingQuantity?: number;
  initialAverageWeightG?: number;
  targetHarvestDate?: string;
  endedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface V4Record {
  id: string;
  farmId: string;
  unitId: string;
  batchId: string;
  type: V4RecordType;
  date: string;
  note: string;
  data: Record<string, unknown>;
  photos: string[];
  templateId?: string;
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface V4InventoryItem {
  id: string;
  farmId: string;
  kind: InventoryKind;
  name: string;
  brand?: string;
  specification?: string;
  lotNumber?: string;
  expiresOn?: string;
  quantityKg: number;
  averageUnitCostYuan: number;
  lowStockKg?: number;
  createdAt: string;
  updatedAt: string;
}

export interface V4InventoryMovement {
  id: string;
  farmId: string;
  itemId: string;
  batchId?: string;
  type: "purchase" | "consume" | "adjust";
  quantityKg: number;
  unitCostYuan: number;
  createdBy: string;
  createdAt: string;
}

export interface V4Task {
  id: string;
  farmId: string;
  unitId?: string;
  batchId?: string;
  type: V4RecordType | "inventory";
  title: string;
  schedule: string;
  reminderTime?: string;
  enabled: boolean;
  lastCompletedDate?: string;
  createdAt: string;
  updatedAt: string;
}

export interface V4Template {
  id: string;
  farmId: string;
  name: string;
  recordType: V4RecordType;
  fields: Array<{
    key: string;
    label: string;
    type: "number" | "text" | "select" | "boolean" | "datetime";
    options?: string[];
    defaultValue?: unknown;
  }>;
  createdAt: string;
  updatedAt: string;
}

export interface V4DeletionAudit {
  id: string;
  farmId: string;
  entityType: "farm" | "unit" | "batch" | "record" | "inventory" | "member";
  entityId: string;
  entityLabel: string;
  deletedBy: string;
  deletedAt: string;
}

export interface V4TelemetryEvent {
  id: string;
  name: string;
  success: boolean;
  durationMs?: number;
  errorType?: string;
  createdAt: string;
}

export interface V4Conflict {
  id: string;
  entityType: string;
  entityId: string;
  field: string;
  localValue: unknown;
  remoteValue: unknown;
}

export interface V4Settings {
  selectedFarmId: string;
  selectedUnitId: string;
  weightUnit: WeightUnit;
  quickRecordTypes: V4RecordType[];
  homeMode: "record" | "overview";
  telemetryEnabled: boolean;
  autoSyncEnabled: boolean;
}

export interface V4Auth {
  status: "guest" | "bound";
  userId: string;
  displayName: string;
}

export interface V4SyncMeta {
  protocolVersion: 4;
  baseRevision: number;
  pendingEntityIds: string[];
  conflicts: V4Conflict[];
  status: SyncState;
  lastSyncedAt: string;
  message: string;
}

export interface V4State {
  version: 3;
  auth: V4Auth;
  farms: V4Farm[];
  members: V4Member[];
  units: V4Unit[];
  batches: V4Batch[];
  records: V4Record[];
  inventory: V4InventoryItem[];
  inventoryMovements: V4InventoryMovement[];
  tasks: V4Task[];
  templates: V4Template[];
  deletionAudit: V4DeletionAudit[];
  telemetry: V4TelemetryEvent[];
  settings: V4Settings;
  syncMeta: V4SyncMeta;
  migration: {
    sourceVersion: 1 | 2 | 3;
    migratedAt: string;
    legacyBackupCreated: boolean;
  };
}

