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

  wx.cloud.init({ env: CLOUDBASE_ENV_ID, traceUser: true });
  cloudInitialized = true;
}

function App(props: { children: JSX.Element }) {
  initCloudBase();
  return props.children;
}

export default App;
