declare const process: {
  env: {
    TARO_APP_API_BASE_URL?: string;
  };
};

export const API_BASE_URL = (process.env.TARO_APP_API_BASE_URL ?? "").trim();

export function isCloudSyncConfigured(): boolean {
  return API_BASE_URL.startsWith("https://");
}

