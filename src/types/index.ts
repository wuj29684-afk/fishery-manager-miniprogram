export type RecordType = "feed" | "water" | "drug" | "harvest";
export type PondStatus = "active" | "inactive";

export interface Pond {
  id: string;
  name: string;
  species: string;
  location: string;
  areaMu: number;
  day: number;
  status: PondStatus;
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
}

export interface FeedRecord extends BaseFarmRecord {
  type: "feed";
  weightKg: number;
  unitPriceYuan: number;
}

export interface WaterRecord extends BaseFarmRecord {
  type: "water";
  ph: number;
  dissolvedOxygen: number;
  ammoniaNitrogen: number;
}

export interface DrugRecord extends BaseFarmRecord {
  type: "drug";
  drugName: string;
  dosage: string;
  withdrawalDays: number;
}

export interface HarvestRecord extends BaseFarmRecord {
  type: "harvest";
  weightKg: number;
  unitPriceYuan: number;
}

export type FarmRecord = FeedRecord | WaterRecord | DrugRecord | HarvestRecord;

export type FarmRecordInput =
  | Omit<FeedRecord, "id" | "createdAt">
  | Omit<WaterRecord, "id" | "createdAt">
  | Omit<DrugRecord, "id" | "createdAt">
  | Omit<HarvestRecord, "id" | "createdAt">;

export interface FarmState {
  version: 1;
  ponds: Pond[];
  records: FarmRecord[];
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
  estimatedProfitYuan: number;
  recordCount: number;
  alert: string;
}

export interface RecordShortcut {
  id: RecordType;
  title: string;
  detail: string;
}
