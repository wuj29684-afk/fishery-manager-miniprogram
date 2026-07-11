import { useEffect, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import { shortcuts } from "../../data/seed";
import { formatArea, formatMoney } from "../../domain/format";
import { calculateFeedCost, calculateRevenue, calculateSurvivalRate, calculateFcr, calculateTotalCost, getCultureDays, getPondAlert, getRecordTitle } from "../../domain/operations";
import { deactivatePond, deletePond, loadFarmState } from "../../storage/farm-store";
import type { FarmRecord, FarmState, Pond } from "../../types";
import "./index.scss";

function getRoutePondId(): string {
  return Taro.getCurrentInstance().router?.params?.id ?? "";
}

export default function PondDetailPage() {
  const [pond, setPond] = useState<Pond | null>(null);
  const [records, setRecords] = useState<FarmRecord[]>([]);

  async function refresh() {
    const state: FarmState = await loadFarmState();
    const pondId = getRoutePondId();
    const currentPond = state.ponds.find((item) => item.id === pondId) ?? null;
    setPond(currentPond);
    setRecords(state.records.filter((item) => item.pondId === pondId));
  }

  useEffect(() => {
    refresh();
  }, []);

  useDidShow(() => {
    refresh();
  });

  async function handleDeactivate() {
    if (!pond || pond.status === "inactive") return;
    const result = await Taro.showModal({
      title: "停用塘口",
      content: "停用后不会删除历史记录，首页会把它放到后面。确认停用吗？",
      confirmText: "停用",
      confirmColor: "#c43d2b"
    });
    if (!result.confirm) return;

    await deactivatePond(pond.id);
    await Taro.showToast({ title: "已停用", icon: "success" });
    await refresh();
  }

  async function handleDelete() {
    if (!pond) return;
    const first = await Taro.showModal({
      title: "删除塘口",
      content: "删除会永久移除该塘口及全部历史记录，并同步删除账号中的对应数据。",
      confirmText: "继续",
      confirmColor: "#c43d2b"
    });
    if (!first.confirm) return;
    const second = await Taro.showModal({
      title: "确认永久删除",
      content: `确定永久删除“${pond.name}”吗？此操作不能直接恢复。`,
      confirmText: "永久删除",
      confirmColor: "#c43d2b"
    });
    if (!second.confirm) return;
    await deletePond(pond.id);
    await Taro.showToast({ title: "塘口已删除", icon: "success" });
    Taro.reLaunch({ url: "/pages/index/index" });
  }

  if (!pond) {
    return (
      <View className="detail-page">
        <Text className="empty">未找到塘口，请返回首页重新选择。</Text>
      </View>
    );
  }

  const revenue = calculateRevenue(records);
  const feedCost = calculateFeedCost(records);
  const totalCost = calculateTotalCost(records);
  const profit = revenue - totalCost;
  const survivalRate = calculateSurvivalRate(pond, records);
  const fcr = calculateFcr(pond, records);
  const sortedRecords = [...records].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  return (
    <View className="detail-page">
      <View className="detail-head">
        <Text className="eyebrow">{pond.species}</Text>
        <Text className="title">{pond.name}</Text>
        {pond.status === "inactive" && <Text className="status-badge">已停用</Text>}
        <Text className="subtitle">
          {pond.location} · {formatArea(pond.areaMu)} · {getCultureDays(pond) === null ? "待补放苗日期" : "第 " + getCultureDays(pond) + " 天"}
        </Text>
        <Text className="alert">{getPondAlert(pond, { version: 2, ponds: [pond], records, settings: { selectedPondId: pond.id, customProfileThresholds: {} }, syncMeta: { protocolVersion: 2, serverRevision: 0, lastSyncedAt: "", deviceId: "", status: "local", message: "", deletedPondIds: [], deletedRecordIds: [] }, migrationMeta: { sourceVersion: 2, migratedAt: "", needsPondCompletion: pond.needsStockingDate } })}</Text>
        <View className="detail-actions">
          <Text className="outline-button" onClick={() => Taro.navigateTo({ url: `/pages/pond-form/index?pondId=${pond.id}` })}>
            编辑塘口
          </Text>
          {pond.status !== "inactive" && (
            <Text className="danger-button" onClick={handleDeactivate}>
              停用塘口
            </Text>
          )}
          <Text className="delete-button" onClick={handleDelete}>
            删除塘口
          </Text>
        </View>
      </View>

      <View className="summary-grid">
        <View className="summary-cell">
          <Text className="summary-label">收入</Text>
          <Text className="summary-value">{formatMoney(revenue)}</Text>
        </View>
        <View className="summary-cell">
          <Text className="summary-label">完整成本</Text>
          <Text className="summary-value">{formatMoney(totalCost)}</Text>
        </View>
        <View className="summary-cell">
          <Text className="summary-label">经营利润</Text>
          <Text className="summary-value">{formatMoney(profit)}</Text>
        </View>
        <View className="summary-cell">
          <Text className="summary-label">成活率 / FCR</Text>
          <Text className="summary-value">{survivalRate === null ? "待补数据" : survivalRate.toFixed(1) + "%"} / {fcr === null ? "--" : fcr.toFixed(2)}</Text>
        </View>
      </View>

      {pond.status === "inactive" ? (
        <View className="section">
          <Text className="inactive-note">该塘口已停用，历史记录仍可查看和编辑。</Text>
        </View>
      ) : (
        <View className="section">
          <Text className="section-title">新增记录</Text>
          <View className="action-grid">
            {shortcuts.map((item) => (
              <Text
                className="action-button"
                key={item.id}
                onClick={() => Taro.navigateTo({ url: `/pages/record-form/index?pondId=${pond.id}&type=${item.id}` })}
              >
                {item.title}
              </Text>
            ))}
            {(["sampling", "mortality", "expense"] as const).map((type) => (
              <Text className="action-button" key={type} onClick={() => Taro.navigateTo({ url: `/pages/record-form/index?pondId=${pond.id}&type=${type}` })}>
                {{ sampling: "抽样", mortality: "死亡", expense: "支出" }[type]}
              </Text>
            ))}
          </View>
        </View>
      )}

      <View className="section">
        <Text className="section-title">记录历史</Text>
        <Text className="section-hint">点击记录可编辑或删除。</Text>
        {sortedRecords.length === 0 ? (
          <Text className="empty">暂无记录</Text>
        ) : (
          sortedRecords.map((record) => (
            <View
              className="history-row"
              key={record.id}
              onClick={() => Taro.navigateTo({ url: `/pages/record-form/index?recordId=${record.id}` })}
            >
              <View>
                <Text className="history-title">{getRecordTitle(record)}</Text>
                <Text className="history-note">{record.note || "无备注"}</Text>
              </View>
              <Text className="history-date">{record.date}</Text>
            </View>
          ))
        )}
      </View>
    </View>
  );
}
