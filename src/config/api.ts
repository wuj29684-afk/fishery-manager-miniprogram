declare const process: {
  env: {
    TARO_APP_API_BASE_URL?: string;
    TARO_APP_CLOUDBASE_ENV_ID?: string;
  };
};

export const API_BASE_URL = (process.env.TARO_APP_API_BASE_URL ?? "").trim();
export const CLOUDBASE_ENV_ID = (process.env.TARO_APP_CLOUDBASE_ENV_ID ?? "").trim();

export type AccountSyncMode = "cloudbase" | "http" | "disabled";

export function isCloudSyncConfigured(): boolean {
  return isCloudBaseSyncConfigured() || isHttpSyncConfigured();
}

export function isHttpSyncConfigured(): boolean {
  return API_BASE_URL.startsWith("https://");
}

export function isCloudBaseSyncConfigured(): boolean {
  return CLOUDBASE_ENV_ID.length > 0;
}

export function getAccountSyncMode(): AccountSyncMode {
  if (isCloudBaseSyncConfigured()) {
    return "cloudbase";
  }
  if (isHttpSyncConfigured()) {
    return "http";
  }
  return "disabled";
}
