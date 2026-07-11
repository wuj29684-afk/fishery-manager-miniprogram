import { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import { isCloudSyncConfigured } from "../../config/api";
import { createId } from "../../domain/id";
import { createLocalStateFromPullResult } from "../../domain/sync-state";
import { pullAccountState, pushAccountState } from "../../services/account-sync-service";
import { loadFarmState, saveFarmState, saveRecoveryPoint } from "../../storage/farm-store";
import type { FarmState } from "../../types";
import "./index.scss";

const DEVICE_ID_KEY = "fishery-manager:device-id:v1";

function getDeviceId(): string {
  const existing = Taro.getStorageSync<string>(DEVICE_ID_KEY);
  if (existing) return existing;
  const next = createId("device");
  Taro.setStorageSync(DEVICE_ID_KEY, next);
  return next;
}

function getCounts(state: FarmState): string {
  const pond = state.ponds.length;
  const rec = state.records.length;
  return `${pond} 个塘口、${rec} 条记录`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message.slice(0, 120);
  if (error && typeof error === "object") {
    const detail = error as { errMsg?: unknown; errorMessage?: unknown; message?: unknown };
    const msg = detail.errMsg || detail.errorMessage || detail.message;
    if (typeof msg === "string" && msg) return msg.slice(0, 120);
    try {
      const s = JSON.stringify(error);
      if (s && s !== "{}") return s.slice(0, 120);
    } catch { /* fall through */ }
  }
  return "网络波动，请稍后重试";
}

async function showSyncDialog(local: FarmState, cloud: FarmState): Promise<"enter" | "restore" | "bind" | null> {
  const hasCloud = cloud.ponds.length > 0 || cloud.records.length > 0;
  const hasLocal = local.ponds.length > 0 || local.records.length > 0;

  if (hasCloud && hasLocal) {
    // Both exist — let user choose direction
    const result = await Taro.showActionSheet({
      itemList: ["使用云端数据（恢复账号备份）", "绑定本机到账号（上传本地数据）", "暂不处理，进入本机"],
    });
    if (result.tapIndex === 0) return "restore";
    if (result.tapIndex === 1) return "bind";
    return "enter";
  }

  if (hasCloud) {
    // Cloud data exists, local is empty — restore
    const confirm = await Taro.showModal({
      title: "恢复账号数据",
      content: `当前微信账号云端有 ${getCounts(cloud)}。是否恢复？`,
      confirmText: "恢复",
      confirmColor: "#0f4d1f",
      cancelText: "暂不恢复",
    });
    return confirm.confirm ? "restore" : "enter";
  }

  if (hasLocal) {
    // Local data exists, cloud is empty — offer bind
    const confirm = await Taro.showModal({
      title: "绑定到当前账号",
      content: `本机有 ${getCounts(local)}。是否同步到当前微信账号？绑定后可在其他手机恢复。`,
      confirmText: "确认绑定",
      confirmColor: "#0f4d1f",
      cancelText: "暂不绑定",
    });
    return confirm.confirm ? "bind" : "enter";
  }

  return "enter";
}

export default function AccountLoginPage() {
  const [loading, setLoading] = useState(false);
  const [cloudAvailable] = useState(() => isCloudSyncConfigured());

  async function handleLogin() {
    if (loading) return;
    setLoading(true);

    try {
      const local = await loadFarmState();
      const entryUrl = "/pages/index/index";

      if (!cloudAvailable) {
        Taro.reLaunch({ url: entryUrl });
        return;
      }

      // Pull cloud state to determine the flow
      try {
        const pulled = await pullAccountState();
        const cloud = createLocalStateFromPullResult(pulled);
        const action = await showSyncDialog(local, cloud);

        if (action === "restore") {
          saveRecoveryPoint(local);
          saveFarmState(cloud);
          Taro.showToast({ title: "账号数据已恢复", icon: "success" });
        } else if (action === "bind") {
          const result = await pushAccountState(local, getDeviceId());
          if (result.conflict) {
            throw new Error("云端数据已更新，请重新选择同步方向");
          }
          Taro.showToast({ title: `已绑定 ${result.ponds.length} 个塘口`, icon: "success" });
        }
        // "enter" or null — just proceed
      } catch (cloudError) {
        // Cloud failed — enter with local data, show the reason
        await Taro.showToast({ title: getErrorMessage(cloudError) + "，进入本机数据", icon: "none", duration: 2500 });
      }

      Taro.reLaunch({ url: entryUrl });
    } catch {
      setLoading(false);
      Taro.showToast({ title: "数据读取失败", icon: "none" });
    } finally {
      setLoading(false);
    }
  }

  function handleLocalOnly() {
    Taro.reLaunch({ url: "/pages/index/index" });
  }

  return (
    <View className="login-page">
      <View className="login-brand">
        <Text className="login-icon">🐟</Text>
        <Text className="login-name">渔儿小助手</Text>
        <Text className="login-tagline">让每一亩水面都有数可查</Text>
      </View>

      <View className="login-actions">
        <View className={`login-primary ${loading ? "login-busy" : ""}`} onClick={handleLogin}>
          <Text className="login-primary-icon">{loading ? "⏳" : "🐟"}</Text>
          <Text className="login-primary-text">{loading ? "正在连接..." : "微信授权登录进入"}</Text>
        </View>
        <View className="login-skip" onClick={handleLocalOnly}>
          离线查看本机数据
        </View>
      </View>

      <View className="login-footnotes">
        <Text className="login-footnote">塘口与记录绑定当前微信账号，不同账号数据完全隔离</Text>
        <Text className="login-footnote">不收集手机号、头像或密码，不接入支付、定位或文件上传</Text>
      </View>
    </View>
  );
}
