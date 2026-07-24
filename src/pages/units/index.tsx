import { useMemo, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Image, Input, Picker, Text, View } from "@tarojs/components";
import { FilterOutlined, Plus, Search } from "@taroify/icons";
import AppTabBar from "../../components/AppTabBar";
import seaCagePhoto from "../../assets/sea-cage-photo.jpg";
import indoorRasTanks from "../../assets/indoor-ras-tanks.jpg";
import otherEcoAquaculture from "../../assets/other-eco-aquaculture.jpg";
import outdoorPondPhoto from "../../assets/outdoor-pond-photo.jpg";
import { loadV4State, saveV4State } from "../../v4/store";
import type { UnitType, V4State } from "../../v4/types";
import "./index.scss";

const labels: Record<UnitType, string> = { pond: "塘口", cage: "网箱", tank: "室内池", other: "其他" };

export default function UnitsPage() {
  const [state, setState] = useState<V4State>(() => loadV4State());
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<"all" | UnitType>("all");
  useDidShow(() => setState(loadV4State()));
  const farmIndex = Math.max(0, state.farms.findIndex((farm) => farm.id === state.settings.selectedFarmId));
  const farm = state.farms[farmIndex];
  const units = useMemo(() => state.units.filter((unit) =>
    unit.farmId === farm?.id &&
    (filter === "all" || unit.type === filter) &&
    [unit.name, unit.location, labels[unit.type]].join(" ").includes(query.trim())
  ), [farm?.id, filter, query, state.units]);

  function chooseFarm(index: number) {
    const nextFarm = state.farms[index];
    if (!nextFarm) return;
    const first = state.units.find((unit) => unit.farmId === nextFarm.id);
    setState(saveV4State({ ...state, settings: { ...state.settings, selectedFarmId: nextFarm.id, selectedUnitId: first?.id || "" } }));
  }

  const groups: UnitType[] = ["cage", "pond", "tank", "other"];
  return <View className="units-page safe-tab-page">
    <View className="units-head">
      <View><Text className="title">养殖单元</Text><Text className="subtitle">{farm?.name || "尚未创建养殖场"}</Text></View>
      <View className="add-unit" onClick={() => Taro.navigateTo({ url: "/pages/pond-form/index" })}><Plus size="20" /><Text>新增</Text></View>
    </View>
    {state.farms.length > 1 && <Picker mode="selector" range={state.farms.map((item) => item.name)} value={farmIndex} onChange={(e) => chooseFarm(Number(e.detail.value))}><Text className="farm-switch">当前：{farm?.name}</Text></Picker>}
    <View className="search-box"><Search size="20" /><Input value={query} placeholder="搜索养殖单元、地点" onInput={(e) => setQuery(e.detail.value)} /><FilterOutlined size="20" /></View>
    <View className="filter-tabs">
      {(["all", "cage", "pond", "tank"] as const).map((item) => <Text className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>{item === "all" ? "全部" : labels[item]}({item === "all" ? state.units.length : state.units.filter((u) => u.type === item).length})</Text>)}
    </View>
    {!units.length ? <View className="empty-state"><Text>暂无符合条件的养殖单元</Text><Text onClick={() => Taro.navigateTo({ url: "/pages/pond-form/index" })}>创建养殖单元</Text></View> :
      groups.map((type) => {
        const list = units.filter((unit) => unit.type === type);
        if (!list.length) return null;
        return <View key={type}>
          <Text className="unit-group-title">{labels[type]}（{list.length}）</Text>
          {list.map((unit, index) => {
            const batch = state.batches.find((item) => item.unitId === unit.id && item.status !== "completed");
            const image = unit.type === "cage" ? seaCagePhoto
              : unit.type === "tank" ? indoorRasTanks
                : unit.type === "other" ? otherEcoAquaculture
                  : outdoorPondPhoto;
            return <View className="unit-card" key={unit.id} onClick={() => Taro.navigateTo({ url: `/pages/pond-detail/index?id=${unit.id}` })}>
              <Image className="unit-thumb" src={image} mode="aspectFill" />
              <View className="unit-copy">
                <View className="unit-title-row"><Text className="unit-name">{unit.name}</Text><Text className={`unit-status ${unit.status === "active" ? "normal" : "attention"}`}>{unit.status === "active" ? "正常" : "停用"}</Text></View>
                <Text className="unit-meta">{batch?.species || "未设置品种"} · {unit.location || "未填写位置"}</Text>
                <Text className="unit-meta">{batch?.stockingDate ? `投放 ${batch.stockingDate}` : "暂无投放日期"}</Text>
              </View>
            </View>;
          })}
        </View>;
      })}
    <AppTabBar active="units" />
  </View>;
}
