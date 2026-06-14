import { useEffect, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Input, View, Text } from "@tarojs/components";
import { shortcuts } from "../../data/seed";
import { formatArea, formatMoney } from "../../domain/format";
import { getDashboardMetrics, getPondSummaries, getRecentRecords, getRecordTitle } from "../../domain/operations";
import { loadFarmState } from "../../storage/farm-store";
import type { FarmState } from "../../types";
import "./index.scss";

type PondStatusFilter = "all" | "active" | "inactive";

const statusFilters: Array<{ value: PondStatusFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "active", label: "养殖中" },
  { value: "inactive", label: "已停用" }
];

export default function IndexPage() {
  const [state, setState] = useState<FarmState | null>(null);
  const [pondQuery, setPondQuery] = useState("");
  const [pondStatusFilter, setPondStatusFilter] = useState<PondStatusFilter>("all");

  async function refresh() {
    setState(await loadFarmState());
  }

  useEffect(() => {
    refresh();
  }, []);

  useDidShow(() => {
    refresh();
  });

  if (!state) {
    return (
      <View className="page">
        <Text className="loading">正在读取本地经营数据...</Text>
      </View>
    );
  }

  const metrics = getDashboardMetrics(state);
  const pondSummaries = getPondSummaries(state);
  const normalizedPondQuery = pondQuery.trim().toLowerCase();
  const visiblePondSummaries = pondSummaries.filter((summary) => {
    const statusMatched =
      pondStatusFilter === "all" ||
      (pondStatusFilter === "active" && summary.pond.status !== "inactive") ||
      (pondStatusFilter === "inactive" && summary.pond.status === "inactive");
    const textMatched =
      !normalizedPondQuery ||
      [summary.pond.name, summary.pond.species, summary.pond.location]
        .join(" ")
        .toLowerCase()
        .includes(normalizedPondQuery);
    return statusMatched && textMatched;
  });
  const recentRecords = getRecentRecords(state);

  return (
    <View className="page">
      <View className="dashboard-head">
        <View className="dashboard-copy">
          <Text className="eyebrow">经营驾驶舱</Text>
          <Text className="title">塘口值班台</Text>
          <Text className="subtitle">收入、成本、预警和记录一屏掌握</Text>
        </View>
        <View className="head-actions">
          <Text className="add-button" onClick={() => Taro.navigateTo({ url: "/pages/pond-form/index" })}>
            新增塘口
          </Text>
          <Text className="backup-button" onClick={() => Taro.navigateTo({ url: "/pages/data-backup/index" })}>
            数据备份
          </Text>
          <Text className="about-button" onClick={() => Taro.navigateTo({ url: "/pages/about-data/index" })}>
            关于与数据
          </Text>
        </View>
      </View>

      <View className="metrics">
        {metrics.map((metric) => (
          <View className={`metric metric-${metric.tone}`} key={metric.label}>
            <Text className="metric-label">{metric.label}</Text>
            <Text className="metric-value">{metric.value}</Text>
          </View>
        ))}
      </View>

      <View className="section">
        <Text className="section-title">塘口经营概览</Text>
        <View className="pond-filter">
          <Input
            className="pond-search"
            value={pondQuery}
            placeholder="搜索塘口、品种或位置"
            onInput={(event) => setPondQuery(event.detail.value)}
          />
          <View className="filter-tabs">
            {statusFilters.map((item) => (
              <Text
                className={`filter-tab ${pondStatusFilter === item.value ? "active" : ""}`}
                key={item.value}
                onClick={() => setPondStatusFilter(item.value)}
              >
                {item.label}
              </Text>
            ))}
          </View>
        </View>
        {visiblePondSummaries.length === 0 ? (
          <Text className="empty">没有匹配的塘口</Text>
        ) : (
          visiblePondSummaries.map((summary) => (
            <View
              className={`pond-card ${summary.pond.status === "inactive" ? "pond-card-inactive" : ""}`}
              key={summary.pond.id}
              onClick={() => Taro.navigateTo({ url: `/pages/pond-detail/index?id=${summary.pond.id}` })}
            >
              <View className="pond-heading">
                <Text className="pond-name">{summary.pond.name}</Text>
                <View className="pond-state">
                  {summary.pond.status === "inactive" && <Text className="pond-status">已停用</Text>}
                  <Text className="pond-day">第 {summary.pond.day} 天</Text>
                </View>
              </View>
              <Text className="pond-meta">
                {summary.pond.species} · {formatArea(summary.pond.areaMu)}
              </Text>
              <Text className="pond-location">{summary.pond.location}</Text>
              <View className="pond-finance">
                <Text>收入 {formatMoney(summary.revenueYuan)}</Text>
                <Text>利润 {formatMoney(summary.estimatedProfitYuan)}</Text>
              </View>
              <Text className="pond-alert">{summary.alert}</Text>
            </View>
          ))
        )}
      </View>

      <View className="section">
        <Text className="section-title">快速记录</Text>
        <View className="shortcut-grid">
          {shortcuts.map((item) => (
            <View
              className="shortcut"
              key={item.id}
              onClick={() => Taro.navigateTo({ url: `/pages/record-form/index?type=${item.id}` })}
            >
              <Text className="shortcut-title">{item.title}</Text>
              <Text className="shortcut-detail">{item.detail}</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="section">
        <Text className="section-title">最近记录</Text>
        {recentRecords.map((record) => (
          <View className="record-row" key={record.id}>
            <Text className="record-title">{getRecordTitle(record)}</Text>
            <Text className="record-date">{record.date}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}
