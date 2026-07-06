import { useEffect, useMemo, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Image, Input, View, Text } from "@tarojs/components";
import heroImage from "../../assets/fishery-dawn-hero.jpg";
import trustBannerImage from "../../assets/local-trust-banner.jpg";
import pondEastImage from "../../assets/pond-east-thumb.jpg";
import pondWestImage from "../../assets/pond-west-thumb.jpg";
import { shortcuts } from "../../data/seed";
import { formatArea, formatMoney, todayString } from "../../domain/format";
import { getDashboardMetrics, getPondSummaries, getRecentRecords, getRecordTitle } from "../../domain/operations";
import { evaluatePondHealth } from "../../domain/pond-health";
import { buildWeeklyReport } from "../../domain/weekly-report";
import { loadFarmState } from "../../storage/farm-store";
import type { FarmRecord, FarmState, PondDashboardSummary, RecordType } from "../../types";
import "./index.scss";

type PondStatusFilter = "all" | "active" | "inactive";

const statusFilters: Array<{ value: PondStatusFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "active", label: "养殖中" },
  { value: "inactive", label: "已停用" }
];

const recordActionMap: Record<RecordType, { label: string; shortLabel: string; tone: string; detail: string }> = {
  feed: { label: "投料记录", shortLabel: "投料", tone: "feed", detail: "饲料重量与单价" },
  water: { label: "水质记录", shortLabel: "水质", tone: "water", detail: "pH / 溶氧 / 氨氮" },
  drug: { label: "用药记录", shortLabel: "用药", tone: "drug", detail: "药品、剂量、休药期" },
  harvest: { label: "收获记录", shortLabel: "收获", tone: "harvest", detail: "出鱼重量与售价" }
};

const pondImages = [pondEastImage, pondWestImage];

function formatChinaDate(date = new Date()): string {
  return `${`${date.getMonth() + 1}`.padStart(2, "0")}月${`${date.getDate()}`.padStart(2, "0")}日`;
}

function weekdayLabel(date = new Date()): string {
  return ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"][date.getDay()];
}

function isCalmAlert(alert: string): boolean {
  return alert.includes("平稳") || alert.includes("暂无预警") || alert.includes("正常");
}

function getRecordValue(record: FarmRecord): string {
  if (record.type === "feed") return `投喂量 ${record.weightKg} kg`;
  if (record.type === "water") return `pH ${record.ph} / 溶氧 ${record.dissolvedOxygen} mg/L`;
  if (record.type === "drug") return `休药期 ${record.withdrawalDays} 天`;
  return `收获 ${record.weightKg} kg`;
}

function getTaskPlan(summaries: PondDashboardSummary[], todayRecords: number) {
  const firstWarning = summaries.find((summary) => !isCalmAlert(summary.alert));
  return [
    {
      index: "1",
      title: firstWarning ? "复核预警塘口" : "复核水质",
      detail: firstWarning ? firstWarning.pond.name : "关注溶氧、氨氮等",
      type: "water" as const
    },
    {
      index: "2",
      title: todayRecords > 0 ? "补齐今日记录" : "补记投料",
      detail: todayRecords > 0 ? `今日已有 ${todayRecords} 条` : "记录投料量与饲料",
      type: "feed" as const
    },
    {
      index: "3",
      title: "查看休药期",
      detail: "规避用药风险",
      type: "drug" as const
    }
  ];
}

function alertLabel(code: string): string {
  const labels: Record<string, string> = {
    LOW_OXYGEN: "溶氧偏低",
    PH_OUT_OF_RANGE: "pH 异常",
    HIGH_AMMONIA: "氨氮偏高",
    MISSING_FEED_RECORD: "补记投料",
    MISSING_WATER_RECORD: "补测水质"
  };
  return labels[code] ?? code;
}

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

  const today = todayString();

  const viewModel = useMemo(() => {
    if (!state) return null;
    const metrics = getDashboardMetrics(state);
    const pondSummaries = getPondSummaries(state);
    const todayRecords = state.records.filter((item) => item.date === today).length;
    const warningCount = pondSummaries.filter((summary) => !isCalmAlert(summary.alert)).length;
    const recentRecords = getRecentRecords(state);
    const focusedPond = pondSummaries.find((summary) => summary.pond.status !== "inactive")?.pond ?? pondSummaries[0]?.pond;
    const focusedHealth = focusedPond ? evaluatePondHealth(state, focusedPond.id, today) : { alerts: [] };
    const focusedReport = focusedPond ? buildWeeklyReport(state, focusedPond.id, today) : null;
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

    return {
      metrics,
      pondSummaries,
      visiblePondSummaries,
      recentRecords,
      todayRecords,
      warningCount,
      focusedPond,
      focusedHealth,
      focusedReport,
      tasks: getTaskPlan(pondSummaries, todayRecords)
    };
  }, [pondQuery, pondStatusFilter, state, today]);

  if (!state || !viewModel) {
    return (
      <View className="page page-loading">
        <Text className="loading">正在读取本地经营数据...</Text>
      </View>
    );
  }

  const activePondMetric = viewModel.metrics[0];
  const todayMetric = viewModel.metrics[1];
  const profitMetric = viewModel.metrics[3];

  return (
    <View className="page">
      <View className="hero">
        <Image className="hero-image" src={heroImage} mode="aspectFill" />
        <View className="hero-shade" />
        <View className="hero-top">
          <View>
            <Text className="eyebrow">清晨值守 · 本地经营驾驶舱</Text>
            <Text className="title">渔儿小助手</Text>
          </View>
          <View className="hero-tools">
            <Text className="tool-pill" onClick={() => Taro.navigateTo({ url: "/pages/about-data/index" })}>
              关于与数据
            </Text>
            <Text className="tool-pill" onClick={() => Taro.navigateTo({ url: "/pages/data-backup/index" })}>
              数据
            </Text>
          </View>
        </View>

        <View className="overview-card">
          <View className="overview-head">
            <Text className="overview-title">今日经营概览</Text>
            <Text className="overview-date">
              {formatChinaDate()} {weekdayLabel()}
            </Text>
          </View>
          <View className="overview-grid">
            <View className="overview-item">
              <Text className="overview-icon overview-water">水</Text>
              <Text className="overview-label">在养塘口</Text>
              <Text className="overview-value">{activePondMetric.value}</Text>
            </View>
            <View className="overview-item">
              <Text className="overview-icon overview-record">记</Text>
              <Text className="overview-label">今日记录</Text>
              <Text className="overview-value">{todayMetric.value}</Text>
            </View>
            <View className="overview-item">
              <Text className="overview-icon overview-money">¥</Text>
              <Text className="overview-label">预计利润</Text>
              <Text className="overview-value">{profitMetric.value}</Text>
            </View>
            <View className="overview-item">
              <Text className="overview-icon overview-alert">警</Text>
              <Text className="overview-label">预警状态</Text>
              <Text className="overview-value">{viewModel.warningCount} 处</Text>
            </View>
          </View>
        </View>
      </View>

      <View className="action-panel">
        <View className="action-card action-primary" onClick={() => Taro.navigateTo({ url: "/pages/pond-form/index" })}>
          <Text className="action-mark">塘</Text>
          <Text className="action-title">新增塘口</Text>
          <Text className="action-detail">建立新的养殖塘口</Text>
        </View>
        <View className="action-card action-blue" onClick={() => Taro.navigateTo({ url: "/pages/record-form/index?type=feed" })}>
          <Text className="action-mark">记</Text>
          <Text className="action-title">快速记录</Text>
          <Text className="action-detail">投料 / 水质 / 用药等</Text>
        </View>
        <View className="action-card action-gold" onClick={() => Taro.navigateTo({ url: "/pages/data-backup/index" })}>
          <Text className="action-mark">备</Text>
          <Text className="action-title">数据备份</Text>
          <Text className="action-detail">备份与账号同步</Text>
        </View>
      </View>

      <View className="section task-section">
        <View className="section-head">
          <Text className="section-title">今日值守</Text>
          <Text className="section-link">建议按顺序完成</Text>
        </View>
        <View className="task-list">
          {viewModel.tasks.map((task) => (
            <View
              className="task-item"
              key={task.index}
              onClick={() => Taro.navigateTo({ url: `/pages/record-form/index?type=${task.type}` })}
            >
              <Text className="task-index">{task.index}</Text>
              <View className="task-copy">
                <Text className="task-title">{task.title}</Text>
                <Text className="task-detail">{task.detail}</Text>
              </View>
              <Text className="task-arrow">›</Text>
            </View>
          ))}
        </View>
      </View>

      {viewModel.focusedPond && viewModel.focusedReport && (
        <View className="section operating-loop">
          <View className="section-head">
            <View>
              <Text className="section-title">本周经营提醒</Text>
              <Text className="loop-subtitle">{viewModel.focusedPond.name}</Text>
            </View>
            <Text className="section-link">
              {viewModel.focusedReport.startDate} 至 {viewModel.focusedReport.endDate}
            </Text>
          </View>
          <View className="loop-grid">
            <View className="loop-item">
              <Text className="loop-value">{viewModel.focusedReport.feedWeightKg.toFixed(1)}kg</Text>
              <Text className="loop-label">本周投料</Text>
            </View>
            <View className="loop-item">
              <Text className="loop-value">{viewModel.focusedReport.waterRecordCount}</Text>
              <Text className="loop-label">水质记录</Text>
            </View>
            <View className="loop-item">
              <Text className="loop-value">{viewModel.focusedHealth.alerts.length}</Text>
              <Text className="loop-label">待关注提醒</Text>
            </View>
          </View>
          {viewModel.focusedHealth.alerts.length > 0 ? (
            <View className="loop-alert-list">
              {viewModel.focusedHealth.alerts.slice(0, 2).map((alert) => (
                <View className={`loop-alert loop-alert-${alert.severity}`} key={alert.code}>
                  <Text className="loop-alert-title">{alertLabel(alert.code)}</Text>
                  <Text className="loop-alert-message">{alert.message}</Text>
                </View>
              ))}
            </View>
          ) : (
            <Text className="loop-calm">本周记录状态平稳，继续保持巡塘和水质复测。</Text>
          )}
        </View>
      )}

      <View className="section">
        <View className="section-head">
          <Text className="section-title">塘口概览</Text>
          <Text className="section-link">全部塘口 {viewModel.pondSummaries.length} 个</Text>
        </View>
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

        {viewModel.visiblePondSummaries.length === 0 ? (
          <Text className="empty">没有匹配的塘口</Text>
        ) : (
          viewModel.visiblePondSummaries.map((summary, index) => (
            <View
              className={`pond-card ${summary.pond.status === "inactive" ? "pond-card-inactive" : ""}`}
              key={summary.pond.id}
              onClick={() => Taro.navigateTo({ url: `/pages/pond-detail/index?id=${summary.pond.id}` })}
            >
              <View className="pond-main">
                <Image className="pond-photo" src={pondImages[index % pondImages.length]} mode="aspectFill" />
                <View className="pond-copy">
                  <View className="pond-heading">
                    <Text className="pond-name">{summary.pond.name}</Text>
                    <Text className={`pond-badge ${isCalmAlert(summary.alert) ? "pond-badge-good" : "pond-badge-warn"}`}>
                      {isCalmAlert(summary.alert) ? "正常" : "预警"}
                    </Text>
                  </View>
                  <Text className="pond-meta">
                    {summary.pond.species} · 养殖 {summary.pond.day} 天 · {formatArea(summary.pond.areaMu)}
                  </Text>
                  <Text className="pond-location">{summary.pond.location}</Text>
                </View>
                <Text className="pond-arrow">›</Text>
              </View>
              <View className="pond-stats">
                <Text>收入 {formatMoney(summary.revenueYuan)}</Text>
                <Text>利润 {formatMoney(summary.estimatedProfitYuan)}</Text>
                <Text>{summary.recordCount} 条记录</Text>
              </View>
              <Text className={`pond-alert ${isCalmAlert(summary.alert) ? "pond-alert-good" : "pond-alert-warn"}`}>
                {summary.alert}
              </Text>
            </View>
          ))
        )}
      </View>

      <View className="section">
        <View className="section-head">
          <Text className="section-title">快速记录</Text>
          <Text className="section-link">现场少敲字</Text>
        </View>
        <View className="shortcut-grid">
          {shortcuts.map((item) => {
            const action = recordActionMap[item.id];
            return (
              <View
                className={`shortcut shortcut-${action.tone}`}
                key={item.id}
                onClick={() => Taro.navigateTo({ url: `/pages/record-form/index?type=${item.id}` })}
              >
                <Text className="shortcut-title">{action.shortLabel}</Text>
                <Text className="shortcut-detail">{action.detail}</Text>
              </View>
            );
          })}
        </View>
      </View>

      <View className="section">
        <View className="section-head">
          <Text className="section-title">最近记录</Text>
          <Text className="section-link">全部记录</Text>
        </View>
        <View className="record-list">
          {viewModel.recentRecords.map((record) => (
            <View
              className="record-row"
              key={record.id}
              onClick={() => Taro.navigateTo({ url: `/pages/record-form/index?recordId=${record.id}` })}
            >
              <Text className={`record-dot record-${record.type}`}>{recordActionMap[record.type].shortLabel.slice(0, 1)}</Text>
              <View className="record-copy">
                <Text className="record-title">{getRecordTitle(record)}</Text>
                <Text className="record-meta">{record.date}</Text>
              </View>
              <Text className="record-value">{getRecordValue(record)}</Text>
              <Text className="record-arrow">›</Text>
            </View>
          ))}
        </View>
      </View>

      <View className="trust-banner" onClick={() => Taro.navigateTo({ url: "/pages/about-data/index" })}>
        <Image className="trust-image" src={trustBannerImage} mode="aspectFill" />
        <View className="trust-content">
          <Text className="trust-icon">✓</Text>
          <View>
            <Text className="trust-title">默认本机保存，主动按账号同步</Text>
            <Text className="trust-detail">微信云开发 · 账号隔离 · 覆盖前确认</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
