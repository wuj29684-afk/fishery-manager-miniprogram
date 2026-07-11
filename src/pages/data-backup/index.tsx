import { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Text, Textarea, View } from "@tarojs/components";
import { isCloudSyncConfigured } from "../../config/api";
import { createJsonBackup, createRecordsCsv, parseJsonBackup } from "../../domain/export";
import { createId } from "../../domain/id";
import { createLocalStateFromPullResult } from "../../domain/sync-state";
import { getAccountSyncStatusText, pullAccountState, pushAccountState } from "../../services/account-sync-service";
import { loadFarmState, saveFarmState, saveRecoveryPoint } from "../../storage/farm-store";
import type { FarmState } from "../../types";
import "./index.scss";

type ExportKind = "json" | "csv";

const DEVICE_ID_KEY = "fishery-manager:device-id:v1";

function getErrorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "操作失败，请稍后重试";
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

export default function DataBackupPage() {
  const [state, setState] = useState<FarmState | null>(null);
  const [preview, setPreview] = useState("");
  const [previewKind, setPreviewKind] = useState<ExportKind>("json");
  const [importText, setImportText] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [syncing, setSyncing] = useState(false);

  async function refresh() {
    setState(await loadFarmState());
  }

  useEffect(() => {
    refresh();
  }, []);

  async function copyText(text: string, title: string) {
    await Taro.setClipboardData({ data: text });
    setPreview(text);
    await Taro.showToast({ title, icon: "success" });
  }

  async function handleCopyJson() {
    if (!state) return;
    setPreviewKind("json");
    await copyText(createJsonBackup(state), "JSON 已复制");
  }

  async function handleCopyCsv() {
    if (!state) return;
    setPreviewKind("csv");
    await copyText(createRecordsCsv(state), "CSV 已复制");
  }

  async function handleRestore() {
    if (restoring) return;
    const result = parseJsonBackup(importText);
    if (!result.valid || !result.state) {
      await Taro.showToast({ title: result.message, icon: "none" });
      return;
    }

    const confirm = await Taro.showModal({
      title: "确认恢复备份",
      content: `将用备份覆盖本机当前数据：${result.state.ponds.length} 个塘口，${result.state.records.length} 条记录。此操作不可撤销。`,
      confirmText: "恢复",
      confirmColor: "#c43d2b"
    });
    if (!confirm.confirm) return;

    setRestoring(true);
    try {
      saveFarmState(result.state);
      setImportText("");
      await refresh();
      await Taro.showToast({ title: "恢复成功", icon: "success" });
    } finally {
      setRestoring(false);
    }
  }

  async function ensureCloudSyncReady(): Promise<boolean> {
    if (!isCloudSyncConfigured()) {
      await Taro.showToast({ title: "云同步服务未配置", icon: "none" });
      return false;
    }
    return true;
  }

  async function handleBindLocalData() {
    if (!state || syncing || !(await ensureCloudSyncReady())) return;
    const confirm = await Taro.showModal({
      title: "绑定本机数据到账号",
      content: `将使用当前微信账号身份，把本机 ${state.ponds.length} 个塘口、${state.records.length} 条记录同步到账号。`,
      confirmText: "绑定",
      confirmColor: "#0f4d1f"
    });
    if (!confirm.confirm) return;

    setSyncing(true);
    try {
      let result = await pushAccountState(state, getDeviceId());
      if (result.conflict) {
        const choice = await Taro.showModal({
          title: "发现数据冲突",
          content: "账号数据已在其他设备更新。取消可保留云端并返回，继续将先保存本机恢复点，再用本机数据覆盖云端。",
          confirmText: "覆盖云端",
          confirmColor: "#c43d2b",
          cancelText: "暂不处理"
        });
        if (!choice.confirm) return;
        saveRecoveryPoint(state);
        result = await pushAccountState(state, getDeviceId(), true);
        if (result.conflict) throw new Error("账号数据仍在更新，请稍后重试");
      }
      const syncedState = createLocalStateFromPullResult(result, state);
      saveFarmState(syncedState);
      setState(syncedState);
      await Taro.showToast({ title: `已同步 ${result.ponds.length} 个塘口`, icon: "success" });
    } catch (error) {
      await Taro.showToast({ title: getErrorMessage(error), icon: "none" });
    } finally {
      setSyncing(false);
    }
  }

  async function handleUseAccountData() {
    if (syncing || !(await ensureCloudSyncReady())) return;

    setSyncing(true);
    try {
      const result = await pullAccountState();
      const current = await loadFarmState();
      const localState = createLocalStateFromPullResult(result, current);
      const confirm = await Taro.showModal({
        title: "使用账号数据",
        content: `将用账号云端数据覆盖本机：${localState.ponds.length} 个塘口，${localState.records.length} 条记录。建议先复制 JSON 备份。`,
        confirmText: "覆盖",
        confirmColor: "#c43d2b"
      });
      if (!confirm.confirm) return;

      saveRecoveryPoint(current);
      saveFarmState(localState);
      await refresh();
      await Taro.showToast({ title: "账号数据已恢复", icon: "success" });
    } catch (error) {
      await Taro.showToast({ title: getErrorMessage(error), icon: "none" });
    } finally {
      setSyncing(false);
    }
  }

  if (!state) {
    return (
      <View className="backup-page">
        <Text className="loading">正在读取本地数据...</Text>
      </View>
    );
  }

  return (
    <View className="backup-page">
      <View className="backup-head">
        <Text className="eyebrow">本地备份</Text>
        <Text className="title">数据与设置</Text>
        <Text className="subtitle">导出和恢复默认只作用于本机本地存储；账号同步仅在配置云端服务后可用。</Text>
      </View>

      <View className="summary-grid">
        <View className="summary-cell">
          <Text className="summary-label">塘口</Text>
          <Text className="summary-value">{state.ponds.length} 个</Text>
        </View>
        <View className="summary-cell">
          <Text className="summary-label">记录</Text>
          <Text className="summary-value">{state.records.length} 条</Text>
        </View>
      </View>

      <View className="sync-section">
        <Text className="section-title">账号同步</Text>
        <Text className="sync-status">
          {getAccountSyncStatusText()}
        </Text>
        <View className={`copy-button ${isCloudSyncConfigured() ? "primary" : "disabled"}`} onClick={handleBindLocalData}>
          {syncing ? "同步中..." : "绑定本机数据到账号"}
        </View>
        <View className={`copy-button ${isCloudSyncConfigured() ? "" : "disabled"}`} onClick={handleUseAccountData}>
          使用账号数据
        </View>
        <Text className="hint">云同步按微信登录账号隔离塘口和记录；覆盖本机前会二次确认。</Text>
      </View>

      <View className="action-section">
        <Text className="section-title">产品与数据说明</Text>
        <View className="copy-button" onClick={() => Taro.navigateTo({ url: "/pages/about-data/index" })}>
          查看功能范围与隐私边界
        </View>
      </View>

      <View className="action-section">
        <Text className="section-title">复制备份</Text>
        <View className="copy-button primary" onClick={handleCopyJson}>
          复制完整 JSON
        </View>
        <View className="copy-button" onClick={handleCopyCsv}>
          复制记录 CSV
        </View>
      </View>

      <View className="restore-section">
        <Text className="section-title">导入恢复</Text>
        <Textarea
          className="restore-input"
          value={importText}
          placeholder="粘贴完整 JSON 备份内容"
          maxlength={-1}
          onInput={(event) => setImportText(event.detail.value)}
        />
        <Text className="danger-copy">恢复会覆盖本机当前塘口和记录，请先确认已有备份。</Text>
        <View className="restore-button" onClick={handleRestore}>
          {restoring ? "恢复中..." : "恢复 JSON 备份"}
        </View>
      </View>

      <View className="preview-section">
        <Text className="section-title">预览</Text>
        <Textarea className="preview" disabled value={preview || "点击上方按钮后，这里会显示最近一次导出的内容。"} maxlength={-1} />
        <Text className="hint">{preview ? `当前预览：${previewKind.toUpperCase()}` : "JSON 可用于恢复，CSV 适合粘贴到表格查看。"}</Text>
      </View>
    </View>
  );
}
