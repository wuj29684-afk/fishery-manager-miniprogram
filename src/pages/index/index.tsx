import { useEffect, useMemo, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Canvas, Image, Picker, Text, View } from "@tarojs/components";
import { Bag, Points, UserOutlined, Warning, Wechat } from "@taroify/icons";
import AppTabBar from "../../components/AppTabBar";
import emptyCageScene from "../../assets/empty-cage-scene.jpg";
import indoorRasTanks from "../../assets/indoor-ras-tanks.jpg";
import otherEcoAquaculture from "../../assets/other-eco-aquaculture.jpg";
import outdoorPondPhoto from "../../assets/outdoor-pond-photo.jpg";
import seaCagePhoto from "../../assets/sea-cage-photo.jpg";
import { calculateBatchMetrics } from "../../v4/metrics";
import { bindCurrentWechatAccount, loadExperienceV4, loadV4State, saveV4State } from "../../v4/store";
import type { V4RecordType, V4State } from "../../v4/types";
import "./index.scss";

const today = () => new Date().toISOString().slice(0, 10);
const quick = [
  { type: "feed" as V4RecordType, label: "投喂", Icon: Bag, tone: "green" },
  { type: "water" as V4RecordType, label: "水质", Icon: Points, tone: "blue" },
  { type: "patrol" as V4RecordType, label: "异常", Icon: Warning, tone: "orange" }
];

function ageDays(date?: string): number {
  if (!date) return 0;
  return Math.max(0, Math.floor((Date.now() - new Date(`${date}T00:00:00`).getTime()) / 86400000));
}

function metric(value: number | null | undefined, suffix = ""): string {
  return value === null || value === undefined ? "暂无法计算" : `${value.toLocaleString()}${suffix}`;
}

export default function IndexPage() {
  const [state, setState] = useState<V4State>(() => loadV4State());
  const [binding, setBinding] = useState(false);
  useDidShow(() => setState(loadV4State()));

  const activeUnits = useMemo(() => state.units.filter((unit) =>
    unit.status === "active" && (!state.settings.selectedFarmId || unit.farmId === state.settings.selectedFarmId)
  ), [state]);
  const selectedUnit = activeUnits.find((unit) => unit.id === state.settings.selectedUnitId) || activeUnits[0];
  const batch = state.batches.find((item) => item.unitId === selectedUnit?.id && item.status !== "completed");
  const metrics = batch ? calculateBatchMetrics(state, batch.id) : null;
  const todayRecords = state.records.filter((record) => record.date === today() && (!selectedUnit || record.unitId === selectedUnit.id));
  const abnormalCount = state.records.filter((record) =>
    record.date === today() && (record.type === "mortality" || record.data.abnormal === true || record.data.severity === "warning")
  ).length;
  const unitRecords = state.records.filter((record) => record.unitId === selectedUnit?.id);

  useEffect(() => {
    if (state.settings.homeMode !== "overview") return;
    const context = Taro.createCanvasContext("homeTrend");
    const width = 640;
    const height = 250;
    context.setFillStyle("#ffffff");
    context.fillRect(0, 0, width, height);
    context.setStrokeStyle("#e6ebf0");
    context.setLineWidth(1);
    [45, 95, 145, 195].forEach((y) => {
      context.beginPath();
      context.moveTo(42, y);
      context.lineTo(620, y);
      context.stroke();
    });
    const values = [42, 56, 51, 63, 58, 72, 61];
    context.setStrokeStyle("#168cf0");
    context.setLineWidth(4);
    context.beginPath();
    values.forEach((value, index) => {
      const x = 52 + index * 90;
      const y = 205 - value * 2;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
    context.setFillStyle("#1ba86f");
    values.forEach((value, index) => {
      const x = 52 + index * 90;
      const y = 205 - value * 2;
      context.beginPath();
      context.arc(x, y, 6, 0, Math.PI * 2);
      context.fill();
    });
    context.setFillStyle("#7c8995");
    context.setFontSize(18);
    ["07-18", "07-19", "07-20", "07-21", "07-22", "07-23", "07-24"].forEach((label, index) => context.fillText(label, 30 + index * 90, 236));
    context.draw();
  }, [state.settings.homeMode, unitRecords.length]);

  function saveMode(homeMode: "record" | "overview") {
    setState(saveV4State({ ...state, settings: { ...state.settings, homeMode } }));
  }

  function selectUnit(index: number) {
    const unit = activeUnits[index];
    if (!unit) return;
    setState(saveV4State({ ...state, settings: { ...state.settings, selectedUnitId: unit.id } }));
  }

  async function bind() {
    if (binding) return;
    setBinding(true);
    try {
      setState(await bindCurrentWechatAccount());
      await Taro.showToast({ title: "微信账号已登录", icon: "success" });
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : "登录失败", icon: "none" });
    } finally {
      setBinding(false);
    }
  }

  function openRecord(type: V4RecordType) {
    if (!batch) {
      Taro.showToast({ title: "请先创建养殖单元和批次", icon: "none" });
      return;
    }
    Taro.navigateTo({ url: `/pages/record-form/index?unitId=${batch.unitId}&type=${type}` });
  }

  const hero = selectedUnit?.type === "cage" ? seaCagePhoto
    : selectedUnit?.type === "tank" ? indoorRasTanks
      : selectedUnit?.type === "other" ? otherEcoAquaculture
        : outdoorPondPhoto;
  return <View className="home-page safe-tab-page">
    <View className="home-head">
      <View><Text className="home-brand">渔儿小助手</Text><Text className="home-date">{today()} · 本机优先</Text></View>
      <View className="login-link" onClick={state.auth.status === "bound" ? () => Taro.navigateTo({ url: "/pages/data-backup/index" }) : bind}>
        <UserOutlined size="20" /><Text>{state.auth.status === "bound" ? state.auth.displayName || "已登录" : binding ? "登录中" : "微信登录（可选）"}</Text>
      </View>
    </View>

    {!state.farms.length ? <View className="first-use">
      <Image className="first-use-art" src={emptyCageScene} mode="aspectFill" />
      <Text className="first-title">从创建养殖单元开始</Text>
      <Text className="first-copy">记录每一次投喂与管理，让养殖更稳、更轻松。</Text>
      <Text className="fm-primary first-action" onClick={() => Taro.navigateTo({ url: "/pages/pond-form/index" })}>创建养殖单元</Text>
      <Text className="fm-secondary first-action" onClick={() => setState(saveV4State(loadExperienceV4()))}>先看体验示例</Text>
      <View className="restore-action" onClick={bind}><Wechat size="24" /><Text>微信登录并恢复数据</Text></View>
    </View> : <>
      <View className="mode-switch">
        <Text className={state.settings.homeMode === "record" ? "active" : ""} onClick={() => saveMode("record")}>现场值守</Text>
        <Text className={state.settings.homeMode === "overview" ? "active" : ""} onClick={() => saveMode("overview")}>经营概览</Text>
      </View>

      {state.settings.homeMode === "record" ? <>
        <View className="unit-hero" onClick={() => selectedUnit && Taro.navigateTo({ url: `/pages/pond-detail/index?id=${selectedUnit.id}` })}>
          <Image className="unit-hero-image" src={hero} mode="aspectFill" />
          <View className="unit-hero-shade" />
          <View className="unit-hero-copy">
            <View><Text className="unit-name">{selectedUnit?.name || "暂无养殖单元"}</Text><Text className="unit-meta">{batch ? `${batch.species} · 养殖 ${ageDays(batch.stockingDate)} 天` : "暂无进行中批次"}</Text></View>
            <Text className="normal-badge">{abnormalCount ? `${abnormalCount} 项关注` : "正常"}</Text>
          </View>
          {activeUnits.length > 1 && <Picker mode="selector" range={activeUnits.map((unit) => unit.name)} onChange={(event) => selectUnit(Number(event.detail.value))}>
            <Text className="switch-unit">切换</Text>
          </Picker>}
        </View>
        <View className={`alert-line ${abnormalCount ? "is-alert" : ""}`}>
          <Warning size="20" />
          <Text>{abnormalCount ? `今天有 ${abnormalCount} 项异常需要处理` : "预计明天有雨，注意增氧与水位管理"}</Text>
        </View>
        <View className="quick-grid">
          {quick.map(({ type, label, Icon, tone }) => <View className={`quick-item quick-${tone}`} key={type} onClick={() => openRecord(type)}>
            <Icon size="34" /><Text>{label}</Text>
          </View>)}
        </View>
        <View className="today-head"><Text>今日值守</Text><Text onClick={() => Taro.navigateTo({ url: "/pages/records/index" })}>更多</Text></View>
        <View className="today-card">
          <View className="today-date"><Text>今日概览</Text><Text>{today()}</Text></View>
          <View className="today-stats">
            <View><Text>{todayRecords.filter((r) => r.type === "feed").reduce((sum, r) => sum + Number(r.data.weightKg || 0), 0)}</Text><Text>投喂 kg</Text></View>
            <View><Text>{todayRecords.filter((r) => r.type === "water").length}/5</Text><Text>水质达标</Text></View>
            <View><Text>{abnormalCount}</Text><Text>异常事件</Text></View>
            <View><Text>{todayRecords.filter((r) => r.type === "drug").length}</Text><Text>用药次</Text></View>
          </View>
        </View>
      </> : <>
        <View className="overview-heading"><Text>本周概览</Text><Text>最近 7 天</Text></View>
        <View className="overview-grid">
          <View><Text>投喂总量(kg)</Text><Text>{metrics ? metric(metrics.feedKg) : "暂无法计算"}</Text><Text className="trend">经营数据持续更新</Text></View>
          <View><Text>存塘量(尾/kg)</Text><Text>{metrics ? metric(metrics.estimatedStockQuantity) : "暂无法计算"}</Text><Text className="trend">基于最近抽样</Text></View>
          <View><Text>成活率(%)</Text><Text>{metrics ? metric(metrics.survivalRate) : "暂无法计算"}</Text><Text className="trend">数据完整后计算</Text></View>
          <View><Text>日均增重(g)</Text><Text>暂无法计算</Text><Text className="trend">需要连续抽样</Text></View>
        </View>
        <View className="overview-heading"><Text>经营趋势</Text><Text>现场记录 {unitRecords.length} 条</Text></View>
        <View className="trend-panel">
          <View className="trend-legend"><Text>● 投喂趋势</Text><Text>● 水质/生长</Text></View>
          <Canvas canvasId="homeTrend" className="home-trend-canvas" />
        </View>
      </>}
    </>}
    <AppTabBar active="home" />
  </View>;
}
