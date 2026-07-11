import { createSyncPushPayload } from "../domain/sync-payload";
import type { FarmState } from "../types";
import type { PullResult, PushResult } from "./sync-client";

declare const wx: {
  cloud?: {
    callFunction<T = unknown>(options: { name: string; data: Record<string, unknown> }): Promise<{ result?: T }>;
  };
};

export async function pushOwnedStateWithCloudBase(
  state: FarmState,
  deviceId: string,
  force = false
): Promise<PushResult> {
  if (!wx.cloud) {
    throw new Error("当前基础库不支持云开发");
  }

  const response = await wx.cloud.callFunction<PushResult>({
    name: "syncAccountData",
    data: {
      action: "push",
      payload: createSyncPushPayload(state, deviceId, force)
    }
  });

  if (!response.result?.ponds || !response.result.records) {
    throw new Error("云同步返回异常");
  }

  return response.result;
}

export async function pullOwnedStateWithCloudBase(): Promise<PullResult> {
  if (!wx.cloud) {
    throw new Error("当前基础库不支持云开发");
  }

  const response = await wx.cloud.callFunction<PullResult>({
    name: "syncAccountData",
    data: { action: "pull" }
  });

  if (!response.result?.ponds || !response.result.records) {
    throw new Error("云同步返回异常");
  }

  return response.result;
}
