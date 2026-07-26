import Taro from "@tarojs/taro";
import { createId } from "../domain/id";
import { CLOUDBASE_ENV_ID, isCloudBaseSyncConfigured } from "../config/api";
import { mergeV4States } from "./merge";
import { createV4State, migrateV2ToV4 } from "./state";
import type { V4State } from "./types";

declare const wx: {
  requestSubscribeMessage(options: { tmplIds: string[] }): Promise<Record<string, string>>;
  cloud?: {
    init(options: { env: string; traceUser: boolean }): void;
    callFunction<T = unknown>(options: { name: string; data: Record<string, unknown> }): Promise<{ result?: T }>;
    uploadFile(options: { cloudPath: string; filePath: string }): Promise<{ fileID: string }>;
  };
};

let cloudInitialized = false;

export function ensureCloudBase(): void {
  if (cloudInitialized || !isCloudBaseSyncConfigured() || !wx.cloud) return;
  wx.cloud.init({ env: CLOUDBASE_ENV_ID, traceUser: true });
  cloudInitialized = true;
}

const STATE_KEY = "fishery-manager:state:v3";
const LEGACY_KEY = "fishery-manager:farm-state:v1";
const LEGACY_BACKUP_KEY = "fishery-manager:legacy-backup:v2";
const BASE_STATE_KEY = "fishery-manager:sync-base:v3";

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

export function loadV4State(): V4State {
  const current = Taro.getStorageSync<V4State>(STATE_KEY);
  if (current?.version === 3) return current;
  const legacy = Taro.getStorageSync<unknown>(LEGACY_KEY);
  return legacy ? migrateV2ToV4(legacy) : createV4State();
}

export function saveV4State(state: V4State): V4State {
  const legacy = Taro.getStorageSync<unknown>(LEGACY_KEY);
  if (legacy && !Taro.getStorageSync(LEGACY_BACKUP_KEY)) {
    Taro.setStorageSync(LEGACY_BACKUP_KEY, legacy);
    state = {
      ...state,
      migration: { ...state.migration, legacyBackupCreated: true }
    };
  }
  Taro.setStorageSync(STATE_KEY, state);
  return state;
}

export function mutateV4State(update: (state: V4State) => V4State): V4State {
  return saveV4State(update(loadV4State()));
}

export function resetV4State(): V4State {
  const state = createV4State();
  Taro.removeStorageSync(STATE_KEY);
  Taro.removeStorageSync(BASE_STATE_KEY);
  return state;
}

export function loadExperienceV4(): V4State {
  const now = new Date().toISOString();
  const date = now.slice(0, 10);
  const state = createV4State(now, "experience");
  state.auth = { status: "guest", userId: "experience", displayName: "体验用户" };
  state.farms = [{
    id: "experience-farm",
    name: "海湾示范场",
    ownerUserId: "experience",
    province: "山东省",
    city: "青岛市",
    district: "即墨区",
    status: "active",
    createdAt: now,
    updatedAt: now
  }];
  state.members = [{
    id: "experience-owner",
    farmId: "experience-farm",
    userId: "experience",
    displayName: "体验用户",
    role: "owner",
    unitIds: [],
    canViewFinance: true,
    status: "active",
    createdAt: now,
    updatedAt: now
  }];
  state.units = [{
    id: "experience-unit",
    farmId: "experience-farm",
    type: "pond",
    name: "1 号南美白对虾池",
    location: "东区",
    areaMu: 8,
    status: "active",
    createdAt: now,
    updatedAt: now
  }];
  state.batches = [{
    id: "experience-batch",
    farmId: "experience-farm",
    unitId: "experience-unit",
    species: "南美白对虾",
    status: "culturing",
    stockingDate: date,
    stockingQuantity: 120000,
    initialAverageWeightG: 0.03,
    createdAt: now,
    updatedAt: now
  }];
  state.records = [{
    id: "experience-feed",
    farmId: "experience-farm",
    unitId: "experience-unit",
    batchId: "experience-batch",
    type: "feed",
    date,
    note: "体验示例数据",
    data: { weightKg: 18, unitCostYuan: 8.6 },
    photos: [],
    createdBy: "experience",
    updatedBy: "experience",
    createdAt: now,
    updatedAt: now
  }];
  state.settings.selectedFarmId = "experience-farm";
  state.settings.selectedUnitId = "experience-unit";
  state.syncMeta.message = "体验示例仅保存在本机";
  return state;
}

function requireCloud() {
  if (!wx.cloud) throw new Error("云开发尚未配置或当前基础库不支持");
  ensureCloudBase();
  return wx.cloud;
}

export async function bindCurrentWechatAccount(displayName = "微信用户"): Promise<V4State> {
  const response = await requireCloud().callFunction<{ openid?: string }>({
    name: "syncAccountData",
    data: { action: "identity" }
  });
  const userId = response.result?.openid;
  if (!userId) throw new Error("未取得微信账号身份");
  return mutateV4State((state) => ({
    ...state,
    auth: { status: "bound", userId, displayName },
    farms: state.farms.map((farm) =>
      !farm.ownerUserId || ["experience", "local-user"].includes(farm.ownerUserId) ? { ...farm, ownerUserId: userId } : farm
    ),
    members: state.members.map((member) =>
      !member.userId || ["experience", "local-user"].includes(member.userId)
        ? { ...member, userId, displayName, updatedAt: new Date().toISOString() }
        : member
    )
  }));
}

export async function syncV4State(): Promise<V4State> {
  const local = loadV4State();
  if (local.auth.status !== "bound") throw new Error("请先绑定当前微信账号");
  const response = await requireCloud().callFunction<{ state?: V4State; revision?: number; syncedAt?: string; conflict?: boolean }>({
    name: "syncAccountData",
    data: { action: "v4Sync", state: local, baseRevision: local.syncMeta.baseRevision }
  });
  if (!response.result?.state) throw new Error("云同步返回异常");
  if (response.result.conflict) {
    const base = Taro.getStorageSync<V4State>(BASE_STATE_KEY) || response.result.state;
    const merged = mergeV4States(base, local, response.result.state);
    const conflicted: V4State = {
      ...merged.state,
      syncMeta: {
        ...merged.state.syncMeta,
        baseRevision: response.result.revision || 0,
        conflicts: merged.conflicts,
        status: merged.conflicts.length ? "conflict" : "pending",
        message: merged.conflicts.length ? `${merged.conflicts.length} 项冲突待处理` : "已合并，需再次同步"
      }
    };
    return saveV4State(conflicted);
  }
  const next: V4State = {
    ...response.result.state,
    auth: local.auth,
    syncMeta: {
      ...response.result.state.syncMeta,
      baseRevision: response.result.revision || 0,
      pendingEntityIds: [],
      conflicts: [],
      status: "synced",
      lastSyncedAt: response.result.syncedAt || new Date().toISOString(),
      message: "已同步"
    }
  };
  Taro.setStorageSync(BASE_STATE_KEY, clone(next));
  return saveV4State(next);
}

export async function uploadRecordPhotos(): Promise<string[]> {
  const selected = await Taro.chooseMedia({
    count: 3,
    mediaType: ["image"],
    sizeType: ["compressed"],
    sourceType: ["album", "camera"]
  });
  const cloud = requireCloud();
  const files = selected.tempFiles.slice(0, 3);
  return Promise.all(files.map(async (file, index) => {
    const extension = file.tempFilePath.split(".").pop() || "jpg";
    const result = await cloud.uploadFile({
      cloudPath: `records/${new Date().toISOString().slice(0, 10)}/${createId(`photo-${index}`)}.${extension}`,
      filePath: file.tempFilePath
    });
    return result.fileID;
  }));
}

export async function requestTaskSubscription(): Promise<boolean> {
  const templateIds = ((process.env.TARO_APP_SUBSCRIBE_TEMPLATE_IDS || "") as string)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  if (!templateIds.length) throw new Error("订阅消息模板尚未配置");
  const result = await wx.requestSubscribeMessage({ tmplIds: templateIds });
  return Object.values(result).some((value) => value === "accept");
}

export function recordTelemetry(name: string, success: boolean, errorType = ""): void {
  mutateV4State((state) => state.settings.telemetryEnabled ? {
    ...state,
    telemetry: [...state.telemetry.slice(-199), {
      id: createId("telemetry"),
      name,
      success,
      ...(errorType ? { errorType } : {}),
      createdAt: new Date().toISOString()
    }]
  } : state);
}
