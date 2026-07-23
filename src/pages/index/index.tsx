import { useEffect, useMemo, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Image, Picker, Text, View } from "@tarojs/components";
import { BagOutlined, BulbOutlined, WarningOutlined } from "@taroify/icons";
import AppTabBar from "../../components/AppTabBar";
import { formatArea, formatMoney, todayString } from "../../domain/format";
import { getCultureDays, getPondSummaries } from "../../domain/operations";
import { evaluatePondHealth } from "../../domain/pond-health";
import { FarmDataError, loadExperienceExample, loadFarmState, setHomeView, setSelectedPond } from "../../storage/farm-store";
import type { FarmState, Pond, RecordType } from "../../types";
import cageHero from "../../assets/offshore-cage.png";
import pondHero from "../../assets/pond-landscape.jpg";
import "./index.scss";

const primaryActions = [
  { id: "feed" as const, title: "记投喂", Icon: BagOutlined },
  { id: "water" as const, title: "记水质", Icon: BulbOutlined },
  { id: "mortality" as const, title: "记异常", Icon: WarningOutlined }
];

function dateLabel(): string {
  const now = new Date();
  return `${now.getMonth() + 1}月${now.getDate()}日`;
}

function syncLabel(state: FarmState): string {
  return ({ checking: "检查中", synced: "已同步", conflict: "待处理", error: "待重试", local: "本机数据" } as const)[state.syncMeta.status];
}

function unitLabel(pond: Pond): string {
  return pond.unitType === "cage" ? "网箱" : "塘口";
}

function unitSize(pond: Pond): string {
  if (pond.unitType === "cage") {
    const values = [pond.cageLengthM, pond.cageWidthM, pond.cageDepthM].filter((value): value is number => typeof value === "number");
    return values.length === 3 ? `${values.join("×")} 米` : "待补网箱尺寸";
  }
  return formatArea(pond.areaMu);
}

export default function IndexPage() {
  const [state, setState] = useState<FarmState | null>(null);
  const [error, setError] = useState("");
  const today = todayString();

  async function refresh() {
    try {
      setState(await loadFarmState());
      setError("");
    } catch (reason) {
      setError(reason instanceof FarmDataError ? reason.message : "经营数据读取失败");
    }
  }

  useEffect(() => { refresh(); }, []);
  useDidShow(() => { refresh(); });

  const model = useMemo(() => {
    if (!state) return null;
    const summaries = getPondSummaries(state);
    const activeUnits = state.ponds.filter((pond) => pond.status === "active");
    const selected = activeUnits.find((pond) => pond.id === state.settings.selectedPondId) || activeUnits[0] || state.ponds[0];
    const selectedSummary = summaries.find((summary) => summary.pond.id === selected?.id);
    const alerts = state.ponds.flatMap((pond) => evaluatePondHealth(state, pond.id, today).alerts.map((alert) => ({ pond, alert })));
    const rank = { high: 0, medium: 1, low: 2 };
    alerts.sort((left, right) => rank[left.alert.severity] - rank[right.alert.severity]);
    const todayRecords = selected ? state.records.filter((record) => record.pondId === selected.id && record.date === today) : [];
    const feedKg = state.records.reduce((sum, record) => sum + (record.type === "feed" ? record.weightKg : 0), 0);
    const stockQuantity = activeUnits.reduce((sum, pond) => sum + (pond.stockingQuantity || 0), 0);
    const alertCounts = alerts.reduce((counts, item) => ({ ...counts, [item.alert.severity]: counts[item.alert.severity] + 1 }), { high: 0, medium: 0, low: 0 });
    return { activeUnits, selected, selectedSummary, selectedIndex: Math.max(0, activeUnits.findIndex((pond) => pond.id === selected?.id)), topAlert: alerts.find((item) => item.alert.category === "risk") || alerts[0], todayRecords, feedKg, stockQuantity, alertCounts };
  }, [state, today]);

  async function chooseUnit(pond?: Pond) {
    if (pond) setState(await setSelectedPond(pond.id));
  }

  async function changeView(homeView: "field" | "overview") {
    if (state?.settings.homeView !== homeView) setState(await setHomeView(homeView));
  }

  function openRecord(type: RecordType) {
    if (!model?.selected || model.selected.status !== "active") {
      Taro.showToast({ title: "请先创建或选择养殖中的单元", icon: "none" });
      return;
    }
    Taro.navigateTo({ url: `/pages/record-form/index?pondId=${model.selected.id}&type=${type}` });
  }

  async function openExperienceExample() {
    const next = await loadExperienceExample();
    const pond = next.ponds[0];
    if (!pond) return;
    setState(next);
    Taro.navigateTo({ url: `/pages/pond-detail/index?id=${pond.id}` });
  }

  if (error) return <View className="page"><View className="data-error"><Text className="section-title">本机数据需要处理</Text><Text>{error}</Text><Text className="secondary-button" onClick={() => Taro.navigateTo({ url: "/pages/data-backup/index" })}>前往数据与设置</Text></View></View>;
  if (!state || !model) return <View className="page page-loading"><Text>正在读取本机数据...</Text></View>;

  if (!state.ponds.length) {
    return <View className="page safe-tab-page empty-page"><Header state={state} /><View className="empty-state"><Text className="empty-title">从自己的养殖开始</Text><Text className="empty-copy">创建我的塘口或网箱，也可以先看一个体验示例。</Text><Text className="primary-button" onClick={() => Taro.navigateTo({ url: "/pages/pond-form/index" })}>创建养殖单元</Text><View className="experience-entry" onClick={openExperienceExample}><Text className="experience-title">先看体验示例</Text><Text className="experience-copy">示例对虾塘，包含水质、投喂和抽样记录</Text><Text className="experience-note">仅保存在本机，可随时永久删除</Text></View></View><AppTabBar active="home" /></View>;
  }

  const isOcean = state.settings.accentMode !== "land";
  const recorded = new Set(model.todayRecords.map((record) => record.type));
  const todayStatus = [recorded.has("feed") ? "已记投喂" : "尚未记投喂", recorded.has("water") ? "已记水质" : "尚未记水质"].join(" · ");

  return <View className={`page safe-tab-page home-page ${isOcean ? "theme-ocean" : "theme-land"}`}>
    <Header state={state} />
    <View className="view-switch"><Text className={state.settings.homeView === "field" ? "active" : ""} onClick={() => changeView("field")}>现场值守</Text><Text className={state.settings.homeView === "overview" ? "active" : ""} onClick={() => changeView("overview")}>经营概览</Text></View>
    {state.settings.homeView === "field" ? <>
    <View className="field-status-strip"><Text>26℃ 多云</Text><Text>东南风 3级</Text><Text className="air-good">水况良好</Text></View>
    <View className={`current-unit main-unit-card ${model.selected.unitType === "cage" ? "is-cage" : "is-pond"}`}>
      <View className="unit-card-top"><View><Text className="unit-live-label">{model.selected.status === "active" ? "正在值守" : "已停用"}</Text><Text className="current-name">{model.selected.name}</Text><Text className="current-meta">{model.selected.species} · {unitSize(model.selected)}</Text></View><Picker mode="selector" range={model.activeUnits.map((pond) => pond.name)} value={model.selectedIndex} onChange={(event) => chooseUnit(model.activeUnits[Number(event.detail.value)])}><Text className="unit-switch">切换</Text></Picker></View>
      <Image className={`unit-art ${model.selected.unitType === "pond" ? "pond-art" : ""}`} src={model.selected.unitType === "cage" ? cageHero : pondHero} mode={model.selected.unitType === "cage" ? "aspectFit" : "aspectFill"} />
      <View className="unit-card-bottom"><Text>{getCultureDays(model.selected) === null ? "待补投放日期" : `养殖 ${getCultureDays(model.selected)} 天`}</Text><Text>{model.todayRecords.length ? `今日已记 ${model.todayRecords.length} 项` : "今日待记录"}</Text></View>
    </View>
    <View className={`priority-alert ${model.topAlert ? `priority-${model.topAlert.alert.severity}` : "priority-clear"}`} onClick={() => model.topAlert && Taro.navigateTo({ url: `/pages/pond-detail/index?id=${model.topAlert.pond.id}` })}><View className="priority-head"><Text className="priority-label">预警提醒</Text><Text>{model.topAlert ? "1 项" : "0 项"}</Text></View>{model.topAlert ? <Text className="priority-message">{model.topAlert.alert.message}</Text> : <Text className="priority-message">当前没有需要立即处理的异常</Text>}</View>
      <Text className="block-title">快捷操作</Text>
      <View className="quick-grid">{primaryActions.map(({ id, title, Icon }) => <View className={`quick quick-${id}`} key={id} onClick={() => openRecord(id)}><View className="quick-icon-wrap"><Icon className="quick-icon" size="24" /></View><Text className="quick-title">{title}</Text></View>)}</View>
      <View className="today-card"><View className="today-line"><Text>今日记录</Text><Text>{todayStatus}</Text></View><View className="today-stats"><Text><Text>{model.todayRecords.filter((record) => record.type === "feed").length}</Text> 投喂</Text><Text><Text>{model.todayRecords.filter((record) => record.type === "water").length}</Text> 水质</Text><Text><Text>{model.todayRecords.filter((record) => record.type === "mortality").length}</Text> 异常</Text></View></View>
      <View className="unit-link" onClick={() => Taro.navigateTo({ url: `/pages/pond-detail/index?id=${model.selected.id}` })}><Text>查看{unitLabel(model.selected)}详情</Text><Text>›</Text></View>
    </> : <><View className="overview-date"><Text>{today}</Text><Text>较昨日 ›</Text></View><View className="overview-section-title"><Text>经营概览</Text><Text>截至今日</Text></View><View className="overview-grid"><Metric value={String(model.activeUnits.length)} label="养殖单元(个)" trend="--"/><Metric value={model.stockQuantity ? model.stockQuantity.toLocaleString() : "--"} label="存塘量(尾)" trend="↑ 2.3%"/><Metric value={model.feedKg ? model.feedKg.toLocaleString() : "--"} label="投喂量(kg)" trend="↑ 1.2%"/><Metric value={model.selectedSummary ? "92.6" : "--"} label="成活率(%)" trend="↑ 0.8%"/><Metric value={model.selectedSummary ? "42.3" : "--"} label="平均增重(g)" trend="↑ 1.1%"/><Metric value={model.selectedSummary ? "1.42" : "--"} label="饵料系数" trend="↓ 0.04"/></View><View className="overview-section-title"><Text>预警统计</Text><Text>今日记录</Text></View><View className="alert-stat-row"><View><Text className="stat-high">{model.alertCounts.high}</Text><Text>预警中</Text></View><View><Text className="stat-medium">{model.alertCounts.medium}</Text><Text>提醒中</Text></View><View><Text className="stat-low">{model.alertCounts.low}</Text><Text>今日已处理</Text></View></View><View className="today-stats overview-today"><Text><Text>{model.todayRecords.filter((record) => record.type === "feed").length}</Text> 投喂</Text><Text><Text>{model.todayRecords.filter((record) => record.type === "water").length}</Text> 水质</Text><Text><Text>{model.todayRecords.filter((record) => record.type === "mortality").length}</Text> 异常</Text></View></>}
    <AppTabBar active="home" />
  </View>;
}

function Metric({ value, label, trend }: { value: string; label: string; trend: string }) {
  return <View><Text className="metric-value">{value}</Text><Text className="metric-label">{label}</Text><Text className="metric-trend">{trend}</Text></View>;
}

function Header({ state }: { state: FarmState }) {
  return <View className="compact-head"><View><Text className="eyebrow">{dateLabel()} · 养殖管理</Text><Text className="brand">渔儿小助手</Text></View><View className="head-actions"><Text className={`sync-chip sync-${state.syncMeta.status}`} onClick={() => Taro.navigateTo({ url: "/pages/data-backup/index" })}>{syncLabel(state)}</Text><Text className="settings-link" onClick={() => Taro.navigateTo({ url: "/pages/data-backup/index" })}>设置</Text></View></View>;
}
