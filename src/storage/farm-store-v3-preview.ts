import Taro from "@tarojs/taro";
import {
  inspectFarmStateV3Storage,
  type FarmStateV3Preview,
  type FarmStateV3PreviewStorage
} from "../domain/farm-state-v3-preview";
import { FARM_STATE_STORAGE_KEY } from "./farm-store";

const taroPreviewStorage: FarmStateV3PreviewStorage = {
  get: (key) => Taro.getStorageSync<unknown>(key),
  set: (key, value) => Taro.setStorageSync(key, value),
  remove: (key) => Taro.removeStorageSync(key)
};

export function inspectCurrentFarmStateV3(
  now = new Date().toISOString()
): FarmStateV3Preview {
  return inspectFarmStateV3Storage(taroPreviewStorage, FARM_STATE_STORAGE_KEY, now);
}
