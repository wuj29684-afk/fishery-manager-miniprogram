import { useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Image, Text, View } from "@tarojs/components";
import { ArrowLeft, Edit, Ellipsis } from "@taroify/icons";
import AppTabBar from "../../components/AppTabBar";
import seaCagePhoto from "../../assets/sea-cage-photo.jpg";
import indoorRasTanks from "../../assets/indoor-ras-tanks.jpg";
import otherEcoAquaculture from "../../assets/other-eco-aquaculture.jpg";
import outdoorPondPhoto from "../../assets/outdoor-pond-photo.jpg";
import { calculateBatchMetrics } from "../../v4/metrics";
import { deleteUnitPermanent, finishBatch } from "../../v4/state";
import { loadV4State, saveV4State } from "../../v4/store";
import type { V4State } from "../../v4/types";
import "./index.scss";

const unitLabels = { pond: "塘口", cage: "网箱", tank: "室内池", other: "其他" } as const;
const tabs = ["概况", "生长", "投喂", "水质", "异常"] as const;

function days(date?: string): number {
  return date ? Math.max(0, Math.floor((Date.now() - new Date(`${date}T00:00:00`).getTime()) / 86400000)) : 0;
}

function display(value: number | null | undefined, suffix = "") {
  return value === null || value === undefined ? "暂无法计算" : `${value.toLocaleString()}${suffix}`;
}

export default function PondDetailPage() {
  const [state, setState] = useState<V4State>(() => loadV4State());
  const [tab, setTab] = useState<typeof tabs[number]>("概况");
  useDidShow(() => setState(loadV4State()));
  const unitId = Taro.getCurrentInstance().router?.params?.id || "";
  const unit = state.units.find((item) => item.id === unitId);
  if (!unit) return <View className="detail-page"><Text>未找到养殖单元</Text></View>;
  const currentUnit = unit;
  const batch = state.batches.find((item) => item.unitId === currentUnit.id && item.status !== "completed");
  const metrics = batch ? calculateBatchMetrics(state, batch.id) : null;
  const records = state.records.filter((record) => record.unitId === currentUnit.id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const filtered = tab === "投喂" ? records.filter((r) => r.type === "feed")
    : tab === "水质" ? records.filter((r) => r.type === "water")
      : tab === "异常" ? records.filter((r) => r.type === "patrol" || r.type === "mortality")
        : records;

  async function endBatch() {
    if (!batch) return;
    const confirm = await Taro.showModal({ title: "结束养殖批次", content: "结束后保留全部历史数据，该单元可创建新批次。", confirmText: "结束批次" });
    if (confirm.confirm) setState(saveV4State(finishBatch(state, batch.id, state.auth.userId || "local-user")));
  }

  async function deleteUnit() {
    const first = await Taro.showModal({ title: "永久删除养殖单元", content: `将删除 ${currentUnit.name} 及 ${records.length} 条关联记录。`, confirmText: "继续", confirmColor: "#c43d2b" });
    if (!first.confirm) return;
    const second = await Taro.showModal({ title: "再次确认", content: "删除后无法恢复，请确认不再使用该养殖单元。", confirmText: "永久删除", confirmColor: "#c43d2b" });
    if (!second.confirm) return;
    saveV4State(deleteUnitPermanent(state, currentUnit.id, state.auth.userId || "local-user"));
    Taro.redirectTo({ url: "/pages/units/index" });
  }

  async function openManage() {
    const result = await Taro.showActionSheet({
      itemList: batch ? ["编辑养殖单元", "结束当前养殖批次", "永久删除养殖单元"] : ["编辑养殖单元", "永久删除养殖单元"]
    });
    if (result.tapIndex === 0) {
      await Taro.showToast({ title: "编辑入口将在下一步完善", icon: "none" });
      return;
    }
    if (batch && result.tapIndex === 1) {
      await endBatch();
      return;
    }
    await deleteUnit();
  }

  const art = currentUnit.type === "cage" ? seaCagePhoto
    : currentUnit.type === "tank" ? indoorRasTanks
      : currentUnit.type === "other" ? otherEcoAquaculture
        : outdoorPondPhoto;
  return <View className="detail-page safe-tab-page">
    <View className="detail-nav"><ArrowLeft size="22" onClick={() => Taro.navigateBack()} /><Text>{currentUnit.name}</Text><Ellipsis size="22" onClick={openManage} /></View>
    <View className={`detail-hero ${currentUnit.type === "pond" ? "pond-hero" : ""}`}>
      <Image className="detail-art" src={art} mode="aspectFill" />
      <View className="hero-shade" />
      <View className="hero-copy">
        <Text className="hero-name">{currentUnit.name}</Text>
        <Text className="hero-meta">{batch ? `${batch.species} · 养殖 ${days(batch.stockingDate)} 天` : `${unitLabels[currentUnit.type]} · 暂无批次`}</Text>
      </View>
      <Text className="hero-status">正常</Text>
    </View>
    <View className="detail-tabs">{tabs.map((item) => <Text className={tab === item ? "active" : ""} key={item} onClick={() => setTab(item)}>{item}</Text>)}</View>

    {tab === "概况" ? <>
      <View className="section-head"><Text>当前批次概况</Text><Text onClick={() => Taro.navigateTo({ url: "/pages/pond-form/index" })}>更多</Text></View>
      <View className="info-list">
        <Info label="投放日期" value={batch?.stockingDate || "待补充"} />
        <Info label="投放尾数" value={display(batch?.stockingQuantity, " 尾")} />
        <Info label="存塘量" value={display(metrics?.estimatedStockQuantity, " 尾")} />
        <Info label="成活率" value={display(metrics?.survivalRate, "%")} />
        <Info label="日均增重" value="暂无法计算" />
        <Info label="当前均重" value="暂无法计算" />
      </View>
    </> : <>
      <View className="section-head"><Text>{tab}记录</Text><Text>{filtered.length} 条</Text></View>
      <View className="info-list">
        {filtered.slice(0, 8).map((record) => <View className="history-row" key={record.id}><Text>{record.date}</Text><Text>{record.note || "已记录"}</Text></View>)}
        {!filtered.length && <Text className="empty">暂无相关记录</Text>}
      </View>
    </>}

    <View className="detail-bottom-actions">
      <Text className="outline-button"><Edit size="18" /> 编辑单元</Text>
      <Text className="primary-record-button" onClick={() => Taro.navigateTo({ url: `/pages/record-form/index?unitId=${currentUnit.id}` })}>记录</Text>
    </View>
    <AppTabBar active="units" />
  </View>;
}

function Info({ label, value }: { label: string; value: string }) {
  return <View className="info-row"><Text>{label}</Text><Text>{value}</Text></View>;
}
