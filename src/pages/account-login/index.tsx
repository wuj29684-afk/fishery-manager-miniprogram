import { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import { isCloudSyncConfigured } from "../../config/api";
import { createId } from "../../domain/id";
import { createLocalStateFromPullResult } from "../../domain/sync-state";
import { pullAccountState, pushAccountState } from "../../services/account-sync-service";
import { loadFarmState, saveFarmState } from "../../storage/farm-store";
import type { FarmState } from "../../types";
import "./index.scss";

const DEVICE_ID_KEY = "fishery-manager:device-id:v1";

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "账号同步失败，请稍后重试";
}

function getDeviceId(): string {
  const existing = Taro.getStorageSync<string>(DEVICE_ID_KEY);
  if (existing) {
    return existing;
  }

  const next = createId("device");
  Taro.setStorageSync(DEVICE_ID_KEY, next);
  return next;
}

function getCounts(state: FarmState): string {
  return `${state.ponds.length} 个塘口、${state.records.length} 条记录`;
}

function hasData(state: FarmState): boolean {
  return state.ponds.length > 0 || state.records.length > 0;
}

function enterDashboard() {
  Taro.reLaunch({ url: "/pages/index/index" });
}

export default function AccountLoginPage() {
  const [state, setState] = useState<FarmState | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    loadFarmState().then(setState);
  }, []);

  async function handleEnterWithAccount() {
    if (!state || syncing) return;

    if (!isCloudSyncConfigured()) {
      await Taro.showToast({ title: "云同步服务未配置", icon: "none" });
      return;
    }

    setSyncing(true);
    try {
      const pulled = await pullAccountState();
      const accountState = createLocalStateFromPullResult(pulled);

      if (hasData(accountState)) {
        const confirm = await Taro.showModal({
          title: "使用账号数据",
          content: `当前微信账号云端有 ${getCounts(accountState)}。是否同步到本机并进入？覆盖本机前建议已复制 JSON 备份。`,
          confirmText: "使用账号数据",
          confirmColor: "#0f4d1f",
          cancelText: "保留本机"
        });

        if (confirm.confirm) {
          saveFarmState(accountState);
          await Taro.showToast({ title: "账号数据已同步", icon: "success" });
        }
        enterDashboard();
        return;
      }

      if (hasData(state)) {
        const confirm = await Taro.showModal({
          title: "绑定本机数据到账号",
          content: `当前微信账号暂无云端资料。是否把本机 ${getCounts(state)} 绑定到当前微信账号？`,
          confirmText: "绑定",
          confirmColor: "#0f4d1f",
          cancelText: "暂不同步"
        });

        if (confirm.confirm) {
          await pushAccountState(state, getDeviceId());
          await Taro.showToast({ title: "已绑定账号", icon: "success" });
        }
      }

      enterDashboard();
    } catch (error) {
      await Taro.showToast({ title: getErrorMessage(error), icon: "none" });
    } finally {
      setSyncing(false);
    }
  }

  return (
    <View className="login-page">
      <View className="login-hero">
        <Text className="eyebrow">渔儿小助手</Text>
        <Text className="title">使用当前微信账号进入</Text>
        <Text className="subtitle">登录时同步账号数据，塘口和记录按当前微信账号隔离保存。</Text>
      </View>

      <View className="login-panel">
        <View className="status-row">
          <Text className="status-label">本机资料</Text>
          <Text className="status-value">{state ? getCounts(state) : "读取中..."}</Text>
        </View>
        <View className="status-row">
          <Text className="status-label">同步方式</Text>
          <Text className="status-value">微信云开发 · 账号隔离</Text>
        </View>
        <View className={`primary-button ${syncing ? "disabled" : ""}`} onClick={handleEnterWithAccount}>
          {syncing ? "同步中..." : "使用当前微信账号进入"}
        </View>
        <View className="secondary-button" onClick={enterDashboard}>
          暂不同步，进入本机数据
        </View>
        <Text className="hint">如账号已有云端数据，会先询问是否使用账号数据；如账号暂无数据，可选择绑定本机数据到账号。</Text>
      </View>

      <View className="trust-list">
        <Text className="trust-item">绑定本机数据到账号：把本机塘口和记录同步到当前微信账号。</Text>
        <Text className="trust-item">使用账号数据：拉取当前微信账号资料，覆盖本机前会二次确认。</Text>
        <Text className="trust-item">不需要手机号、头像昵称或单独密码；不接入支付、定位或文件上传。</Text>
      </View>
    </View>
  );
}
