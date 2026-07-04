import Taro from "@tarojs/taro";
import { createSyncPushPayload, type SyncPushPayload } from "../domain/sync-payload";
import type { FarmState } from "../types";

export interface PullResult {
  serverRevision: number;
  ponds: FarmState["ponds"];
  records: FarmState["records"];
}

export type PushResult = PullResult;

export async function pushOwnedState(
  apiBaseUrl: string,
  sessionToken: string,
  state: FarmState,
  deviceId: string,
  lastSyncedAt?: string
): Promise<PushResult> {
  const payload: SyncPushPayload = createSyncPushPayload(state, deviceId, lastSyncedAt);
  const response = await Taro.request<PushResult>({
    url: `${apiBaseUrl}/v1/sync/push`,
    method: "POST",
    header: {
      Authorization: `Bearer ${sessionToken}`
    },
    data: payload
  });

  if (!response.data) {
    throw new Error("同步服务返回异常");
  }

  return response.data;
}

export async function pullOwnedState(apiBaseUrl: string, sessionToken: string): Promise<PullResult> {
  const response = await Taro.request<PullResult>({
    url: `${apiBaseUrl}/v1/sync/pull`,
    method: "GET",
    header: {
      Authorization: `Bearer ${sessionToken}`
    }
  });

  if (!response.data) {
    throw new Error("同步服务返回异常");
  }

  return response.data;
}
