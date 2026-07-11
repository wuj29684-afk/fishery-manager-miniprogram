import { useEffect, useMemo, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Input, Picker, Text, View } from "@tarojs/components";
import { shortcuts } from "../../data/seed";
import { formatArea, formatMoney, todayString } from "../../domain/format";
import { getCultureDays, getPondSummaries } from "../../domain/operations";
import { evaluatePondHealth } from "../../domain/pond-health";
import { FarmDataError, loadExperienceExample, loadFarmState, setSelectedPond } from "../../storage/farm-store";
import type { FarmState, Pond, RecordType } from "../../types";
import "./index.scss";
import "./index-v2.scss";

type PondStatusFilter = "all" | "active" | "inactive";

const filters: Array<{ value: PondStatusFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "active", label: "养殖中" },
  { value: "inactive", label: "已停用" }
];

function dateLabel(): string {
  const now = new Date();
  return `${now.getMonth() + 1}月${now.getDate()}日`;
}

function syncLabel(state: FarmState): string {
  return ({ checking: "检查中", synced: "已同步", conflict: "待处理", error: "待重试", local: "本机数据" } as const)[state.syncMeta.status];
}

export default function IndexPage() {
  const [state, setState] = useState<FarmState | null>(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PondStatusFilter>("all");
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
    const activePonds = state.ponds.filter((pond) => pond.status === "active");
    const selected = activePonds.find((pond) => pond.id === state.settings.selectedPondId) || activePonds[0] || state.ponds[0];
    const alerts = state.ponds.flatMap((pond) => evaluatePondHealth(state, pond.id, today).alerts.map((alert) => ({ pond, alert })));
    const rank = { high: 0, medium: 1, low: 2 };
    alerts.sort((left, right) => rank[left.alert.severity] - rank[right.alert.severity]);
    const normalized = query.trim().toLowerCase();
    return {
      activePonds,
      selected,
      selectedIndex: Math.max(0, activePonds.findIndex((pond) => pond.id === selected?.id)),
      topAlert: alerts.find((item) => item.alert.category === "risk") || alerts[0],
      visible: summaries.filter((summary) => {
        const statusMatches = filter === "all" || summary.pond.status === filter;
        const text = [summary.pond.name, summary.pond.species, summary.pond.location].join(" ").toLowerCase();
        return statusMatches && (!normalized || text.includes(normalized));
      })
    };
  }, [filter, query, state, today]);

  async function choosePond(pond?: Pond) {
    if (pond) setState(await setSelectedPond(pond.id));
  }

  function openRecord(type: RecordType) {
    if (!model?.selected || model.selected.status !== "active") {
      Taro.showToast({ title: "请先创建或选择养殖中的塘口", icon: "none" });
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

  if (error) {
    return <View className="page"><View className="data-error"><Text className="section-title">本机数据需要处理</Text><Text>{error}</Text><Text className="secondary-button" onClick={() => Taro.navigateTo({ url: "/pages/data-backup/index" })}>前往数据与设置</Text></View></View>;
  }
  if (!state || !model) return <View className="page page-loading"><Text>正在读取本机数据...</Text></View>;

  if (!state.ponds.length) {
    return <View className="page empty-page"><Header state={state} /><View className="empty-state"><Text className="empty-title">从自己的塘口开始</Text><Text className="empty-copy">创建真实塘口，或先打开一个体验示例看看日常记录、预警和经营数据如何呈现。</Text><Text className="primary-button" onClick={() => Taro.navigateTo({ url: "/pages/pond-form/index" })}>创建我的塘口</Text><View className="experience-entry" onClick={openExperienceExample}><Text className="experience-title">先看体验示例</Text><Text className="experience-copy">示例对虾塘，包含水质、投料和抽样记录</Text><Text className="experience-note">仅保存在本机，可随时永久删除</Text></View></View></View>;
  }

  return <View className="page">
    <Header state={state} />
    {model.topAlert ? (
      <View className={`priority-alert priority-${model.topAlert.alert.severity}`}>
        <Text className="priority-label">优先关注 · {model.topAlert.pond.name}</Text>
        <Text className="priority-message">{model.topAlert.alert.message}</Text>
      </View>
    ) : (
      <View className="priority-alert priority-calm"><Text className="priority-label">当前没有异常预警</Text><Text className="priority-message">按需要完成今天的现场记录。</Text></View>
    )}

    <View className="section current-pond">
      <View className="section-head"><Text className="section-title">当前塘口</Text><Picker mode="selector" range={model.activePonds.map((pond) => pond.name)} value={model.selectedIndex} onChange={(event) => choosePond(model.activePonds[Number(event.detail.value)])}><Text className="pond-switch">切换</Text></Picker></View>
      {model.selected && <><Text className="current-name">{model.selected.name}</Text><Text className="current-meta">{model.selected.species} · {formatArea(model.selected.areaMu)} · {getCultureDays(model.selected) === null ? "待补放苗日期" : `养殖 ${getCultureDays(model.selected)} 天`}</Text></>}
      <View className="quick-grid">{shortcuts.map((item) => <View className={`quick quick-${item.id}`} key={item.id} onClick={() => openRecord(item.id)}><Text className="quick-title">{item.title}</Text><Text className="quick-detail">{item.detail}</Text></View>)}</View>
    </View>

    <View className="section">
      <View className="section-head"><Text className="section-title">我的塘口</Text><Text className="section-link" onClick={() => Taro.navigateTo({ url: "/pages/pond-form/index" })}>新增塘口</Text></View>
      <Input className="pond-search" value={query} placeholder="搜索塘口、品种或位置" onInput={(event) => setQuery(event.detail.value)} />
      <View className="filter-tabs">{filters.map((item) => <Text className={`filter-tab ${filter === item.value ? "active" : ""}`} key={item.value} onClick={() => setFilter(item.value)}>{item.label}</Text>)}</View>
      {model.visible.map((summary) => <View className={`pond-card ${summary.pond.status === "inactive" ? "pond-card-inactive" : ""}`} key={summary.pond.id} onClick={() => Taro.navigateTo({ url: `/pages/pond-detail/index?id=${summary.pond.id}` })}><View className="pond-heading"><Text className="pond-name">{summary.pond.name}</Text><Text className={`alert-dot alert-${summary.alertSeverity}`}>{summary.alertSeverity === "none" ? "正常" : "关注"}</Text></View><Text className="pond-meta">{summary.pond.species} · {formatArea(summary.pond.areaMu)}</Text>{summary.recordCount ? <View className="pond-stats"><Text>收入 {formatMoney(summary.revenueYuan)}</Text><Text>利润 {formatMoney(summary.operatingProfitYuan)}</Text><Text>{summary.recordCount} 条</Text></View> : <Text className="empty">暂无经营数据</Text>}<Text className="pond-alert">{summary.alert}</Text></View>)}
    </View>
  </View>;
}

function Header({ state }: { state: FarmState }) {
  return <View className="compact-head"><View><Text className="eyebrow">{dateLabel()} · 养殖管理</Text><Text className="brand">渔儿小助手</Text></View><View className="head-tools"><Text className={`sync-chip sync-${state.syncMeta.status}`}>{syncLabel(state)}</Text><Text className="icon-button" onClick={() => Taro.navigateTo({ url: "/pages/records/index" })}>记录</Text><Text className="icon-button" onClick={() => Taro.navigateTo({ url: "/pages/data-backup/index" })}>数据</Text></View></View>;
}
