import { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Text, Textarea, View } from "@tarojs/components";
import { createJsonBackup, createRecordsCsv, parseJsonBackup } from "../../domain/export";
import { loadFarmState, saveFarmState } from "../../storage/farm-store";
import type { FarmState } from "../../types";
import "./index.scss";

type ExportKind = "json" | "csv";

export default function DataBackupPage() {
  const [state, setState] = useState<FarmState | null>(null);
  const [preview, setPreview] = useState("");
  const [previewKind, setPreviewKind] = useState<ExportKind>("json");
  const [importText, setImportText] = useState("");
  const [restoring, setRestoring] = useState(false);

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
    await copyText(createJsonBackup(state), "JSON已复制");
  }

  async function handleCopyCsv() {
    if (!state) return;
    setPreviewKind("csv");
    await copyText(createRecordsCsv(state), "CSV已复制");
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
      confirmText: "确认恢复",
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
        <Text className="title">数据备份</Text>
        <Text className="subtitle">导出和恢复都只作用于本机本地存储，不上传服务器。</Text>
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

      <View className="action-section">
        <Text className="section-title">复制备份</Text>
        <Text className="copy-button primary" onClick={handleCopyJson}>
          复制完整 JSON
        </Text>
        <Text className="copy-button" onClick={handleCopyCsv}>
          复制记录 CSV
        </Text>
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
        <Text className="restore-button" onClick={handleRestore}>
          {restoring ? "恢复中..." : "恢复 JSON 备份"}
        </Text>
      </View>

      <View className="preview-section">
        <Text className="section-title">预览</Text>
        <Textarea
          className="preview"
          disabled
          value={preview || "点击上方按钮后，这里会显示最近一次导出的内容。"}
          maxlength={-1}
        />
        <Text className="hint">{preview ? `当前预览：${previewKind.toUpperCase()}` : "JSON 可用于恢复，CSV 适合粘贴到表格查看。"}</Text>
      </View>
    </View>
  );
}
