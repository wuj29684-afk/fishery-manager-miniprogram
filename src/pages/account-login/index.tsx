import { useState } from "react";
import Taro from "@tarojs/taro";
import { Image, Text, View } from "@tarojs/components";
import { ShieldOutlined, Wechat } from "@taroify/icons";
import { isCloudSyncConfigured } from "../../config/api";
import { createId } from "../../domain/id";
import { createLocalStateFromPullResult } from "../../domain/sync-state";
import { pullAccountState, pushAccountState } from "../../services/account-sync-service";
import { hasExperienceExample, loadFarmState, removeKnownDemoState, saveFarmState, saveRecoveryPoint } from "../../storage/farm-store";
import brandEmblem from "../../assets/brand-emblem.png";
import pondLandscape from "../../assets/pond-landscape.jpg";
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
        <Image className="login-emblem" src={brandEmblem} mode="aspectFit" />
        <Text className="login-name">渔儿小助手</Text>
        <Text className="login-tagline">专业的水产养殖管理工具</Text>
      </View>
      <Image className="login-landscape" src={pondLandscape} mode="aspectFill" />

      <View className="login-actions">
        <View className={`login-primary ${loading ? "login-busy" : ""}`} onClick={handleAccountEntry}>
          <Wechat className="login-primary-icon" size="22" />
          <Text className="login-primary-text">{loading ? "正在进入账号数据..." : "微信登录并同步"}</Text>
        </View>
        <View className="login-skip" onClick={enterHome}>仅在本机使用</View>
      </View>

      <View className="login-footnotes">
        <ShieldOutlined className="login-shield" size="18" />
        <Text className="login-footnote">登录即表示同意《用户协议》与《隐私政策》</Text>
        <Text className="login-footnote login-footnote-secondary">数据加密传输，仅限您的信息安全</Text>
      </View>
    </View>
  );
}
