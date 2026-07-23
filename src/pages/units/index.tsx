import { useEffect, useMemo, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Image, Input, Text, View } from "@tarojs/components";
import { AddOutlined, Search } from "@taroify/icons";
import AppTabBar from "../../components/AppTabBar";
import { formatArea } from "../../domain/format";
import { getPondSummaries } from "../../domain/operations";
import { loadFarmState } from "../../storage/farm-store";
import type { FarmState, FarmUnitType } from "../../types";
import cageArt from "../../assets/offshore-cage.png";
import pondArt from "../../assets/pond-west-thumb.jpg";
import "./index.scss";

type UnitTypeFilter = "all" | FarmUnitType;
const filters: Array<{ value: UnitTypeFilter; label: string }> = [{ value: "all", label: "全部" }, { value: "cage", label: "网箱" }, { value: "pond", label: "塘口" }];

function sizeLabel(pond: FarmState["ponds"][number]): string {
  if (pond.unitType === "pond") return formatArea(pond.areaMu);
  const values = [pond.cageLengthM, pond.cageWidthM, pond.cageDepthM].filter((value): value is number => typeof value === "number");
  return values.length === 3 ? `${values.join("×")} 米` : "待补网箱尺寸";
}

export default function UnitsPage() {
  const [state, setState] = useState<FarmState | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<UnitTypeFilter>("all");
  async function refresh() { setState(await loadFarmState()); }
  useEffect(() => { refresh(); }, []);
  useDidShow(() => { refresh(); });

  const units = useMemo(() => {
    if (!state) return [];
    const normalized = query.trim().toLowerCase();
    return getPondSummaries(state).filter((summary) => {
      const typeMatches = filter === "all" || summary.pond.unitType === filter;
      const text = [summary.pond.name, summary.pond.species, summary.pond.location].join(" ").toLowerCase();
      return typeMatches && (!normalized || text.includes(normalized));
    });
  }, [filter, query, state]);
  const cages = units.filter((summary) => summary.pond.unitType === "cage");
  const ponds = units.filter((summary) => summary.pond.unitType === "pond");

  const renderUnit = (summary: (typeof units)[number]) => <View className={`unit-card ${summary.pond.unitType === "cage" ? "unit-cage" : "unit-pond"} ${summary.pond.status === "inactive" ? "inactive" : ""}`} key={summary.pond.id} onClick={() => Taro.navigateTo({ url: `/pages/pond-detail/index?id=${summary.pond.id}` })}><Image className="unit-thumb" src={summary.pond.unitType === "cage" ? cageArt : pondArt} mode={summary.pond.unitType === "cage" ? "aspectFit" : "aspectFill"} /><View className="unit-copy"><View className="unit-title-row"><Text className="unit-name">{summary.pond.name}</Text><Text className={summary.alertSeverity === "none" ? "unit-status normal" : summary.alertSeverity === "high" ? "unit-status danger" : "unit-status attention"}>{summary.alertSeverity === "none" ? "正常" : summary.alertSeverity === "high" ? "异常" : "值守中"}</Text></View><Text className="unit-meta">{summary.pond.species}　{sizeLabel(summary.pond)}</Text></View></View>;

  return <View className="units-page safe-tab-page">
    <View className="units-head"><Text className="title">养殖单元</Text><View className="add-unit" onClick={() => Taro.navigateTo({ url: "/pages/pond-form/index" })}><AddOutlined size="21" /><Text>新增</Text></View></View>
    <View className="search-box"><Search size="20" /><Input className="unit-search" value={query} placeholder="搜索养殖单元名称" onInput={(event) => setQuery(event.detail.value)} /><Text>筛选</Text></View>
    <View className="filter-tabs">{filters.map((item) => <Text className={filter === item.value ? "active" : ""} key={item.value} onClick={() => setFilter(item.value)}>{item.label}({item.value === "all" ? state?.ponds.length || 0 : state?.ponds.filter((pond) => pond.unitType === item.value).length || 0})</Text>)}</View>
    {!state ? <Text className="empty">正在读取本机数据...</Text> : !units.length ? <View className="empty-state"><Text>{state.ponds.length ? "没有符合条件的养殖单元" : "还没有养殖单元"}</Text><Text onClick={() => Taro.navigateTo({ url: "/pages/pond-form/index" })}>{state.ponds.length ? "调整筛选条件" : "创建第一个"}</Text></View> : <>{cages.length > 0 && <><Text className="unit-group-title">网箱</Text>{cages.map(renderUnit)}</>}{ponds.length > 0 && <><Text className="unit-group-title">塘口</Text>{ponds.map(renderUnit)}</>}</>}
    <AppTabBar active="units" />
  </View>;
}
