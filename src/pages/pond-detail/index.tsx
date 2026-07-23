import { useEffect, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Image, Text, View } from "@tarojs/components";
import { BagOutlined, BarChartOutlined, BulbOutlined, CouponOutlined, GoldCoinOutlined, RecordsOutlined, WarningOutlined } from "@taroify/icons";
import AppTabBar from "../../components/AppTabBar";
import { shortcuts } from "../../data/seed";
import { formatArea, formatMoney } from "../../domain/format";
import { calculateFeedCost, calculateRevenue, calculateSurvivalRate, calculateFcr, calculateTotalCost, getCultureDays, getPondAlert, getRecordTitle } from "../../domain/operations";
import { deactivatePond, deletePond, loadFarmState } from "../../storage/farm-store";
import type { FarmRecord, FarmState, Pond } from "../../types";
import cageArt from "../../assets/offshore-cage.png";
import pondArt from "../../assets/pond-landscape.jpg";
import "./index.scss";

const actionIcons = { feed: BagOutlined, water: BulbOutlined, drug: CouponOutlined, harvest: BarChartOutlined, sampling: RecordsOutlined, mortality: WarningOutlined, expense: GoldCoinOutlined };

function getRoutePondId(): string {
  return Taro.getCurrentInstance().router?.params?.id ?? "";
}

function unitSize(pond: Pond): string {
  if (pond.unitType === "pond") return formatArea(pond.areaMu);
  const dimensions = [pond.cageLengthM, pond.cageWidthM, pond.cageDepthM];
  return dimensions.every((value) => typeof value === "number") ? `${dimensions.join("×")}米` : "待补网箱尺寸";
}

export default function PondDetailPage() {
  const [pond, setPond] = useState<Pond | null>(null);
  const [records, setRecords] = useState<FarmRecord[]>([]);
  const [activeTab, setActiveTab] = useState<"overview" | "growth" | "feed" | "water" | "alert">("overview");

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
    <View className="detail-page safe-tab-page">
      <View className={`detail-head detail-hero ${pond.unitType === "cage" ? "cage-hero" : "pond-hero"}`}>
        <View className="hero-copy"><Text className="eyebrow">{pond.unitType === "cage" ? "海上网箱" : "养殖塘口"} · {pond.species}</Text>
        <Text className="title">{pond.name}</Text>
        {pond.status === "inactive" && <Text className="status-badge">已停用</Text>}
        <Text className="subtitle">
          {pond.location} · {unitSize(pond)} · {getCultureDays(pond) === null ? "待补投放日期" : "第 " + getCultureDays(pond) + " 天"}
        </Text>
        </View><Image className={`detail-art ${pond.unitType === "pond" ? "pond-detail-art" : ""}`} src={pond.unitType === "cage" ? cageArt : pondArt} mode={pond.unitType === "cage" ? "aspectFit" : "aspectFill"} />
        <View className="hero-status"><Text>{pond.status === "active" ? "正常" : "已停用"}</Text></View>
      </View>
      <View className="detail-tabs">{([['overview','概况'],['growth','生长'],['feed','投喂'],['water','水质'],['alert','异常']] as const).map(([key,label]) => <Text className={activeTab === key ? "active" : ""} key={key} onClick={() => setActiveTab(key)}>{label}</Text>)}</View>
      {activeTab === "overview" ? <>
        <View className="info-list"><Info label="所属区域" value={pond.location || "待补充"}/><Info label="养殖品种" value={pond.species}/><Info label="规格尺寸" value={pond.unitType === "cage" ? `${pond.cageLengthM || "-"}×${pond.cageWidthM || "-"}×${pond.cageDepthM || "-"}米` : formatArea(pond.areaMu)}/><Info label="投放日期" value={pond.stockingDate || "待补充"}/><Info label="投放规格" value={pond.initialSize || "待补充"}/><Info label="投放数量" value={pond.stockingQuantity ? `${pond.stockingQuantity.toLocaleString()}尾` : "待补充"}/><Info label="当前存塘量" value={pond.stockingQuantity ? `${Math.max(0, pond.stockingQuantity - records.reduce((sum, record) => sum + (record.type === "mortality" ? record.count : 0), 0)).toLocaleString()}尾` : "暂无法计算"}/><Info label="成活率" value={survivalRate === null ? "暂无法计算" : `${survivalRate.toFixed(1)}%`}/><Info label="备注" value="-"/></View>
      </> : <View className="section tab-content"><Text className="section-title">{{ growth: "生长记录", feed: "投喂记录", water: "水质记录", alert: "异常记录" }[activeTab]}</Text>{sortedRecords.filter((record) => activeTab === "growth" ? record.type === "sampling" : activeTab === "alert" ? record.type === "mortality" : record.type === activeTab).slice(0, 6).map((record) => <View className="history-row" key={record.id} onClick={() => Taro.navigateTo({ url: `/pages/record-form/index?recordId=${record.id}` })}><Text className="history-title">{getRecordTitle(record)}</Text><Text className="history-date">{record.date}</Text></View>)}</View>}
      <View className="detail-bottom-actions"><Text className="outline-button" onClick={() => Taro.navigateTo({ url: `/pages/pond-form/index?pondId=${pond.id}` })}>编辑</Text><Text className="primary-record-button" onClick={() => Taro.navigateTo({ url: `/pages/record-form/index?pondId=${pond.id}` })}>记录</Text></View>
      <View className="management-section"><Text className="section-title">养殖单元管理</Text><Text className="section-hint">停用保留历史记录，永久删除无法直接恢复。</Text>{pond.status !== "inactive" && <Text className="danger-button" onClick={handleDeactivate}>停用养殖单元</Text>}<Text className="delete-button" onClick={handleDelete}>永久删除养殖单元</Text></View>
      <AppTabBar active="units" />
    </View>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <View className="info-row"><Text>{label}</Text><Text>{value}</Text></View>;
}
