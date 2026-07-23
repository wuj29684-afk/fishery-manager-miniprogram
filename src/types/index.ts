export type RecordType = "feed" | "water" | "drug" | "harvest" | "sampling" | "mortality" | "expense";
export type PondStatus = "active" | "inactive";
export type FarmUnitType = "pond" | "cage";
export type AlertProfileId = "shrimp" | "tilapia" | "cageFish" | "general";
export type AlertSeverity = "low" | "medium" | "high";
export type SyncStatus = "local" | "checking" | "synced" | "conflict" | "error";
export type HomeView = "field" | "overview";
export type AccentMode = "auto" | "land" | "ocean";

export interface WaterThresholds {
  phMin: number;
  phMax: number;
  dissolvedOxygenMin: number;
  ammoniaNitrogenMax: number;
  nitriteMax?: number;
  temperatureMin?: number;
  temperatureMax?: number;
  salinityMin?: number;
  salinityMax?: number;
}

export interface Pond {
  id: string;
  unitType: FarmUnitType;
  name: string;
  species: string;
  location: string;
  areaMu: number;
  cageLengthM?: number;
  cageWidthM?: number;
  cageDepthM?: number;
  cageSpecification?: string;
  status: PondStatus;
  stockingDate?: string;
  stockingQuantity?: number;
  initialSize?: string;
  cultureStage?: string;
  alertProfileId: AlertProfileId;
  customThresholds?: Partial<WaterThresholds>;
  targetHarvestDate?: string;
  legacyStockingDays?: number;
  needsStockingDate: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface BaseFarmRecord {
  id: string;
  pondId: string;
  type: RecordType;
  date: string;
  note: string;
  createdAt: string;
  updatedAt: string;
}

export interface FeedRecord extends BaseFarmRecord {
  type: "feed";
  weightKg: number;
  unitPriceYuan: number;
  feedName?: string;
  feedBatch?: string;
  meal?: string;
  plannedWeightKg?: number;
  appetite?: "good" | "normal" | "poor";
  leftover?: string;
}

export interface WaterRecord extends BaseFarmRecord {
  type: "water";
  ph: number;
  dissolvedOxygen: number;
  ammoniaNitrogen: number;
  measuredAt?: string;
  temperature?: number;
  nitrite?: number;
  salinity?: number;
  transparencyCm?: number;
  alkalinity?: number;
}

export interface DrugRecord extends BaseFarmRecord {
  type: "drug";
  drugName: string;
  dosage: string;
  withdrawalDays: number;
  withdrawalEndDate: string;
  reason?: string;
  activeIngredient?: string;
  method?: string;
  operator?: string;
  costYuan?: number;
}

export interface HarvestRecord extends BaseFarmRecord {
  type: "harvest";
  weightKg: number;
  unitPriceYuan: number;
  sizeSpec?: string;
  buyer?: string;
}

export interface SamplingRecord extends BaseFarmRecord {
  type: "sampling";
  sampleCount: number;
  averageWeightG: number;
  estimatedStockQuantity?: number;
}

export interface MortalityRecord extends BaseFarmRecord {
  type: "mortality";
  count: number;
  suspectedCause?: string;
  handling?: string;
}

export type ExpenseCategory = "seed" | "electricity" | "labor" | "rent" | "equipment" | "other";

export interface ExpenseRecord extends BaseFarmRecord {
  type: "expense";
  category: ExpenseCategory;
  amountYuan: number;
  itemName: string;
}

export type FarmRecord = FeedRecord | WaterRecord | DrugRecord | HarvestRecord | SamplingRecord | MortalityRecord | ExpenseRecord;
export type FarmRecordInput =
  | Omit<FeedRecord, "id" | "createdAt" | "updatedAt">
  | Omit<WaterRecord, "id" | "createdAt" | "updatedAt">
  | Omit<DrugRecord, "id" | "createdAt" | "updatedAt">
  | Omit<HarvestRecord, "id" | "createdAt" | "updatedAt">
  | Omit<SamplingRecord, "id" | "createdAt" | "updatedAt">
  | Omit<MortalityRecord, "id" | "createdAt" | "updatedAt">
  | Omit<ExpenseRecord, "id" | "createdAt" | "updatedAt">;

export interface FarmSettings {
  selectedPondId: string;
  homeView: HomeView;
  accentMode: AccentMode;
  customProfileThresholds: Partial<Record<AlertProfileId, Partial<WaterThresholds>>>;
}

export interface SyncMeta {
  protocolVersion: 3;
  serverRevision: number;
  lastSyncedAt: string;
  deviceId: string;
  status: SyncStatus;
  message: string;
  deletedPondIds: string[];
  deletedRecordIds: string[];
}

export interface MigrationMeta {
  sourceVersion: 1 | 2;
  migratedAt: string;
  needsPondCompletion: boolean;
}

export interface FarmState {
  version: 2;
  ponds: Pond[];
  records: FarmRecord[];
  settings: FarmSettings;
  syncMeta: SyncMeta;
  migrationMeta: MigrationMeta;
}

export interface DashboardMetric {
  label: string;
  value: string;
  tone: "good" | "warn" | "danger";
}

export interface PondDashboardSummary {
  pond: Pond;
  revenueYuan: number;
  feedCostYuan: number;
  totalCostYuan: number;
  operatingProfitYuan: number;
  recordCount: number;
  alert: string;
  alertSeverity: AlertSeverity | "none";
}

export interface RecordShortcut {
  id: Extract<RecordType, "feed" | "water" | "drug" | "harvest">;
  title: string;
  detail: string;
}
