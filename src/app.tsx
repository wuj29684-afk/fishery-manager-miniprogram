import { CLOUDBASE_ENV_ID, isCloudBaseSyncConfigured } from "./config/api";
import { useDidShow } from "@tarojs/taro";
import { loadV4State, recordTelemetry, syncV4State } from "./v4/store";
import "./app.scss";

declare const wx: {
  cloud?: {
    init(options: { env: string; traceUser: boolean }): void;
  };
};

let cloudInitialized = false;

function initCloudBase() {
  if (cloudInitialized || !isCloudBaseSyncConfigured() || !wx.cloud) {
    return;
  }

  try {
    wx.cloud.init({ env: CLOUDBASE_ENV_ID, traceUser: true });
  } catch (error) {
    console.warn("CloudBase init failed; account sync will report the retryable error when used.", error);
  } finally {
    cloudInitialized = true;
  }
}

function App(props: { children: JSX.Element }) {
  initCloudBase();
  useDidShow(() => {
    const state = loadV4State();
    if (state.auth.status === "bound" && state.settings.autoSyncEnabled && state.syncMeta.pendingEntityIds.length) {
      syncV4State()
        .then(() => recordTelemetry("auto-sync", true))
        .catch((error) => recordTelemetry("auto-sync", false, error instanceof Error ? error.name : "unknown"));
    }
  });
  return props.children;
}

export default App;
