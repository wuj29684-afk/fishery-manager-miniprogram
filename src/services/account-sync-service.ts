import { API_BASE_URL, getAccountSyncMode } from "../config/api";
import type { FarmState } from "../types";
import { loginWithServer } from "./auth-client";
import { pullOwnedStateWithCloudBase, pushOwnedStateWithCloudBase } from "./cloudbase-sync-client";
import { pullOwnedState, pushOwnedState, type PullResult, type PushResult } from "./sync-client";

export function getAccountSyncStatusText(): string {
  const mode = getAccountSyncMode();
  if (mode === "cloudbase") {
    return "云开发同步已配置，可按微信账号同步资料。";
  }
  if (mode === "http") {
    return "HTTPS 云同步服务已配置，可按微信账号同步资料。";
  }
  return "暂未配置云同步服务，本版本不会发起网络或云同步请求。";
}

export async function pushAccountState(state: FarmState, deviceId: string, force = false): Promise<PushResult> {
  const mode = getAccountSyncMode();
  if (mode === "cloudbase") {
    return pushOwnedStateWithCloudBase(state, deviceId, force);
  }
  if (mode === "http") {
    const session = await loginWithServer(API_BASE_URL);
    return pushOwnedState(API_BASE_URL, session.sessionToken, state, deviceId, force);
  }
  throw new Error("云同步服务未配置");
}

export async function pullAccountState(): Promise<PullResult> {
  const mode = getAccountSyncMode();
  if (mode === "cloudbase") {
    return pullOwnedStateWithCloudBase();
  }
  if (mode === "http") {
    const session = await loginWithServer(API_BASE_URL);
    return pullOwnedState(API_BASE_URL, session.sessionToken);
  }
  throw new Error("云同步服务未配置");
}
