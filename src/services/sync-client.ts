import Taro from "@tarojs/taro";
import type { FarmState } from "../types";

export interface PullResult {
  serverRevision: number;
  ponds: FarmState["ponds"];
  records: FarmState["records"];
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
