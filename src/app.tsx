import { CLOUDBASE_ENV_ID, isCloudBaseSyncConfigured } from "./config/api";
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

  cloudInitialized = true;
  setTimeout(() => {
    try {
      wx.cloud?.init({ env: CLOUDBASE_ENV_ID, traceUser: true });
    } catch (error) {
      console.warn("CloudBase init failed; local data remains available.", error);
    }
  }, 0);
}

function App(props: { children: JSX.Element }) {
  initCloudBase();
  return props.children;
}

export default App;
