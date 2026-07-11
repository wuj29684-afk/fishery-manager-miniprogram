import { useState } from "react";
import Taro from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import { isCloudSyncConfigured } from "../../config/api";
import { createId } from "../../domain/id";
import { createLocalStateFromPullResult } from "../../domain/sync-state";
import { pullAccountState, pushAccountState } from "../../services/account-sync-service";
import { hasExperienceExample, loadFarmState, removeKnownDemoState, saveFarmState, saveRecoveryPoint } from "../../storage/farm-store";
import "./index.scss";

const DEVICE_ID_KEY = "fishery-manager:device-id:v1";

function getDeviceId(): string {
  const existing = Taro.getStorageSync<string>(DEVICE_ID_KEY);
  if (existing) return existing;
  const next = createId("device");
  Taro.setStorageSync(DEVICE_ID_KEY, next);
  return next;
}

function enterHome() {
  Taro.reLaunch({ url: "/pages/index/index" });
}

export default function AccountLoginPage() {
  const [loading, setLoading] = useState(false);

  async function handleAccountEntry() {
    if (loading) return;
    if (!isCloudSyncConfigured()) {
      Taro.showToast({ title: "账号同步暂未配置，可先直接进入", icon: "none" });
      return;
    }

    setLoading(true);
    try {
      const local = await loadFarmState();
      const pulled = await pullAccountState();
      const accountState = removeKnownDemoState(createLocalStateFromPullResult(pulled, local));

      if (accountState.ponds.length || accountState.records.length) {
        saveRecoveryPoint(local);
        saveFarmState(accountState);
        await Taro.showToast({ title: "已进入微信账号数据", icon: "success" });
      } else if (local.ponds.length || local.records.length) {
        if (hasExperienceExample(local)) {
          await Taro.showToast({ title: "体验示例仅保存在本机，不会同步", icon: "none" });
          enterHome();
          return;
        }
        const pushed = await pushAccountState(local, getDeviceId());
        if (pushed.conflict) {
          const latest = removeKnownDemoState(createLocalStateFromPullResult(await pullAccountState(), local));
          saveRecoveryPoint(local);
          saveFarmState(latest);
          await Taro.showToast({ title: "账号数据已更新，已使用最新数据", icon: "none" });
        } else {
          saveFarmState(createLocalStateFromPullResult(pushed, local));
          await Taro.showToast({ title: "本机数据已绑定到微信账号", icon: "success" });
        }
      }
      enterHome();
    } catch {
      await Taro.showToast({ title: "账号数据暂不可用，可先直接进入", icon: "none" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <View className="login-page">
      <View className="login-brand">
        <Text className="login-name">渔儿小助手</Text>
        <Text className="login-tagline">简单记录，安心养殖</Text>
      </View>

      <View className="login-actions">
        <View className={`login-primary ${loading ? "login-busy" : ""}`} onClick={handleAccountEntry}>
          <Text className="login-primary-text">{loading ? "正在进入账号数据..." : "使用微信账号数据进入"}</Text>
        </View>
        <View className="login-skip" onClick={enterHome}>暂不登录，直接进入</View>
      </View>

      <View className="login-footnotes">
        <Text className="login-footnote">账号进入会使用当前微信账号下的塘口和记录。</Text>
        <Text className="login-footnote">直接进入只使用本机数据，之后仍可在数据与设置中同步。</Text>
      </View>
    </View>
  );
}
