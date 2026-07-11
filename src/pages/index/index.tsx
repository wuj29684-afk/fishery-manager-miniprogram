import { useEffect, useMemo, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Input, Picker, Text, View } from "@tarojs/components";
import { shortcuts } from "../../data/seed";
import { formatArea, formatMoney, todayString } from "../../domain/format";
import { getCultureDays, getPondSummaries, getRecentRecords, getRecordTitle } from "../../domain/operations";
import { evaluatePondHealth } from "../../domain/pond-health";
import { buildWeeklyReport } from "../../domain/weekly-report";
import { FarmDataError, loadFarmState, setSelectedPond } from "../../storage/farm-store";
import type { FarmState, Pond, RecordType } from "../../types";
import "./index.scss";
import "./index-v2.scss";

type PondStatusFilter = "all" | "active" | "inactive";
const filters: Array<{ value: PondStatusFilter; label: string }> = [
  { value: "all", label: "全部" }, { value: "active", label: "养殖中" }, { value: "inactive", label: "已停用" }
];
const dateLabel = () => String(new Date().getMonth() + 1).padStart(2, "0") + "月" + String(new Date().getDate()).padStart(2, "0") + "日";
const syncLabel = (state: FarmState) => ({ checking: "检查备份中", synced: "账号已同步", conflict: "待处理冲突", error: "同步待重试", local: "本机数据" }[state.syncMeta.status]);

export default function IndexPage() {
  const [state, setState] = useState<FarmState | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PondStatusFilter>("all");
  const [weeklyOpen, setWeeklyOpen] = useState(false);
  const today = todayString();

  async function refresh() {
    try { setState(await loadFarmState()); setError(""); }
    catch (reason) { setError(reason instanceof FarmDataError ? reason.message : "经营数据读取失败"); }
  }
  useEffect(() => { refresh(); }, []);
  useDidShow(() => { refresh(); });

  const model = useMemo(() => {
    if (!state) return null;
    const summaries = getPondSummaries(state);
    const activePonds = state.ponds.filter((pond) => pond.status === "active");
    const selected = activePonds.find((pond) => pond.id === state.settings.selectedPondId) || activePonds[0] || state.ponds[0];
    const alerts = state.ponds.flatMap((pond) => evaluatePondHealth(state, pond.id, today).alerts.map((alert) => ({ pond, alert })));
    const severityRank = { high: 0, medium: 1, low: 2 };
    alerts.sort((a, b) => severityRank[a.alert.severity] - severityRank[b.alert.severity]);
    const normalized = query.trim().toLowerCase();
    return {
      summaries, activePonds, selected,
      selectedIndex: Math.max(0, activePonds.findIndex((pond) => pond.id === selected?.id)),
      topAlert: alerts.find((item) => item.alert.category === "risk") || alerts[0],
      selectedHealth: selected ? evaluatePondHealth(state, selected.id, today) : { alerts: [] },
      weekly: selected ? buildWeeklyReport(state, selected.id, today) : null,
      recent: getRecentRecords(state),
      visible: summaries.filter((summary) => {
        const matchesStatus = filter === "all" || summary.pond.status === filter;
        return matchesStatus && (!normalized || [summary.pond.name, summary.pond.species, summary.pond.location].join(" ").toLowerCase().includes(normalized));
      })
    };
  }, [filter, query, state, today]);

  async function choosePond(pond: Pond | undefined) { if (pond) setState(await setSelectedPond(pond.id)); }
  function openRecord(type: RecordType) {
    if (!model?.selected || model.selected.status !== "active") { Taro.showToast({ title: "请先创建或选择养殖中的塘口", icon: "none" }); return; }
    Taro.navigateTo({ url: "/pages/record-form/index?pondId=" + model.selected.id + "&type=" + type });
  }

  if (error) return <View className="page"><View className="data-error"><Text className="section-title">本机数据需要处理</Text><Text>{error}</Text><Text className="secondary-button" onClick={() => Taro.navigateTo({ url: "/pages/data-backup/index" })}>前往数据与设置</Text></View></View>;
  if (!state || !model) return <View className="page page-loading"><Text>正在读取本机经营数据...</Text></View>;
  if (!state.ponds.length) return <View className="page empty-page"><Header state={state} /><View className="empty-state"><Text className="empty-title">建立第一个养殖塘口</Text><Text className="empty-copy">创建后即可记录投喂、水质、用药和收获，账号备份会在后台检查。</Text><Text className="primary-button" onClick={() => Taro.navigateTo({ url: "/pages/pond-form/index" })}>创建第一个塘口</Text></View></View>;

  return <View className="page">
    <Header state={state} />
    {model.topAlert ? <View className={"priority-alert priority-" + model.topAlert.alert.severity}><Text className="priority-label">优先关注 · {model.topAlert.pond.name}</Text><Text className="priority-message">{model.topAlert.alert.message}</Text></View> : <View className="priority-alert priority-calm"><Text className="priority-label">今日无异常预警</Text><Text className="priority-message">继续保持巡塘和现场记录。</Text></View>}
    <View className="section current-pond">
      <View className="section-head"><Text className="section-title">当前塘口</Text><Picker mode="selector" range={model.activePonds.map((pond) => pond.name)} value={model.selectedIndex} onChange={(event) => choosePond(model.activePonds[Number(event.detail.value)])}><Text className="pond-switch">切换塘口</Text></Picker></View>
      {model.selected && <><Text className="current-name">{model.selected.name}</Text><Text className="current-meta">{model.selected.species} · {formatArea(model.selected.areaMu)} · {getCultureDays(model.selected) === null ? "待补放苗日期" : "养殖 " + getCultureDays(model.selected) + " 天"}</Text></>}
      <View className="quick-grid">{shortcuts.map((item) => <View className={"quick quick-" + item.id} key={item.id} onClick={() => openRecord(item.id)}><Text className="quick-title">{item.title}</Text><Text className="quick-detail">{item.detail}</Text></View>)}</View>
    </View>
    <View className="section"><View className="section-head"><Text className="section-title">今日值守</Text><Text className="section-link">{state.records.filter((record) => record.date === today).length} 条已记录</Text></View><View className="duty-grid"><Text className={state.records.some((r) => r.date === today && r.type === "feed") ? "duty done" : "duty"}>投喂</Text><Text className={state.records.some((r) => r.date === today && r.type === "water") ? "duty done" : "duty"}>水质</Text><Text className={model.selectedHealth.alerts.some((a) => a.category === "risk") ? "duty warn" : "duty done"}>风险复核</Text></View></View>
    <View className="section">
      <View className="section-head"><Text className="section-title">塘口概览</Text><Text className="section-link" onClick={() => Taro.navigateTo({ url: "/pages/pond-form/index" })}>新增塘口</Text></View>
      <Input className="pond-search" value={query} placeholder="搜索塘口、品种或位置" onInput={(event) => setQuery(event.detail.value)} />
      <View className="filter-tabs">{filters.map((item) => <Text className={"filter-tab " + (filter === item.value ? "active" : "")} key={item.value} onClick={() => setFilter(item.value)}>{item.label}</Text>)}</View>
      {model.visible.map((summary) => <View className={"pond-card " + (summary.pond.status === "inactive" ? "pond-card-inactive" : "")} key={summary.pond.id} onClick={() => Taro.navigateTo({ url: "/pages/pond-detail/index?id=" + summary.pond.id })}><View className="pond-heading"><Text className="pond-name">{summary.pond.name}</Text><Text className={"alert-dot alert-" + summary.alertSeverity}>{summary.alertSeverity === "none" ? "正常" : "关注"}</Text></View><Text className="pond-meta">{summary.pond.species} · {formatArea(summary.pond.areaMu)}</Text>{summary.recordCount ? <View className="pond-stats"><Text>收入 {formatMoney(summary.revenueYuan)}</Text><Text>利润 {formatMoney(summary.operatingProfitYuan)}</Text><Text>{summary.recordCount} 条</Text></View> : <Text className="empty">暂无经营数据</Text>}<Text className="pond-alert">{summary.alert}</Text></View>)}
    </View>
    {model.weekly && <View className="section"><View className="section-head" onClick={() => setWeeklyOpen(!weeklyOpen)}><Text className="section-title">本周经营</Text><Text className="section-link">{weeklyOpen ? "收起" : "展开"}</Text></View>{weeklyOpen && <View className="weekly-grid"><Text>投料 {model.weekly.feedWeightKg.toFixed(1)}kg</Text><Text>水质 {model.weekly.waterRecordCount} 次</Text><Text>用药 {model.weekly.drugRecordCount} 次</Text><Text>提醒 {model.weekly.alertCount} 项</Text></View>}</View>}
    <View className="section"><View className="section-head"><Text className="section-title">最近记录</Text><Text className="section-link">最近 5 条</Text></View>{model.recent.length ? model.recent.map((record) => <View className="record-row" key={record.id} onClick={() => Taro.navigateTo({ url: "/pages/record-form/index?recordId=" + record.id })}><View><Text className="record-title">{getRecordTitle(record)}</Text><Text className="record-note">{record.note || "无备注"}</Text></View><Text className="record-date">{record.date}</Text></View>) : <Text className="empty">暂无现场记录</Text>}</View>
  </View>;
}

function Header({ state }: { state: FarmState }) {
  return <View className="compact-head"><View><Text className="eyebrow">{dateLabel()} · 今日值守</Text><Text className="brand">渔儿小助手</Text></View><View className="head-tools"><Text className={"sync-chip sync-" + state.syncMeta.status}>{syncLabel(state)}</Text><Text className="icon-button" onClick={() => Taro.navigateTo({ url: "/pages/data-backup/index" })}>数据</Text></View></View>;
}
