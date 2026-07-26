import { useMemo, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Picker, Text, View } from "@tarojs/components";
import { Bag, Certificate, FilterOutlined, Fire, Points, Search, Warning } from "@taroify/icons";
import AppTabBar from "../../components/AppTabBar";
import { formatLocalDate } from "../../v4/date";
import { deleteV4Record } from "../../v4/state";
import { loadV4State, saveV4State } from "../../v4/store";
import type { V4Record, V4State } from "../../v4/types";
import "./index.scss";

const labels: Record<string, string> = {
  feed: "投喂", water: "水质", drug: "用药", patrol: "巡塘", sampling: "抽样",
  mortality: "死亡", harvest: "收获", expense: "支出", custom: "自定义"
};

function summary(record: V4Record): string {
  if (record.type === "feed") return `投喂量：${record.data.weightKg ?? "-"} kg`;
  if (record.type === "water") return `水温 ${record.data.temperatureC ?? "-"}℃ · 溶氧 ${record.data.dissolvedOxygenMgL ?? "-"} mg/L · pH ${record.data.ph ?? "-"}`;
  if (record.type === "drug") return `用量 ${record.data.amount ?? "-"} · 成本 ¥${record.data.costYuan ?? 0}`;
  if (record.type === "mortality") return `死亡 ${record.data.count ?? 0} 尾`;
  if (record.type === "patrol") return record.data.abnormal ? "发现异常，等待处理" : "巡塘正常";
  return record.note || "已完成记录";
}

const iconFor = (type: string) => type === "feed" ? Bag : type === "water" ? Points : type === "drug" ? Certificate : type === "mortality" ? Fire : Warning;

function dateLabel(date: string): string {
  const now = new Date();
  const today = formatLocalDate(now);
  now.setDate(now.getDate() - 1);
  const yesterday = formatLocalDate(now);
  return date === today ? "今天" : date === yesterday ? "昨天" : "历史";
}

export default function RecordsPage() {
  const [state, setState] = useState<V4State>(() => loadV4State());
  const [typeFilter, setTypeFilter] = useState("all");
  const [unitFilter, setUnitFilter] = useState("all");
  useDidShow(() => setState(loadV4State()));
  const records = useMemo(() => state.records.filter((record) =>
    (typeFilter === "all" || record.type === typeFilter) &&
    (unitFilter === "all" || record.unitId === unitFilter)
  ).sort((a, b) => b.createdAt.localeCompare(a.createdAt)), [state.records, typeFilter, unitFilter]);
  const dates = Array.from(new Set(records.map((record) => record.date)));

  async function remove(record: V4Record) {
    const confirm = await Taro.showModal({ title: "删除这条记录", content: `${labels[record.type]}记录删除后无法恢复。`, confirmText: "删除", confirmColor: "#c43d2b" });
    if (!confirm.confirm) return;
    setState(saveV4State(deleteV4Record(loadV4State(), record.id, state.auth.userId || "local-user")));
  }

  return <View className="records-page safe-tab-page">
    <View className="records-head"><Text className="records-title">记录</Text><View className="records-tools"><Search size="21" /><FilterOutlined size="21" /></View></View>
    <View className="record-chips">
      {["all", "feed", "water", "patrol", "drug", "harvest", "sampling", "mortality", "expense"].map((type) => <Text className={typeFilter === type ? "active" : ""} key={type} onClick={() => setTypeFilter(type)}>{type === "all" ? "全部" : labels[type]}</Text>)}
    </View>
    <Picker mode="selector" range={["全部养殖单元", ...state.units.map((unit) => unit.name)]} onChange={(e) => setUnitFilter(["all", ...state.units.map((unit) => unit.id)][Number(e.detail.value)])}>
      <Text className="unit-filter">{unitFilter === "all" ? "全部养殖单元" : state.units.find((unit) => unit.id === unitFilter)?.name}</Text>
    </Picker>
    {!dates.length ? <View className="records-empty"><Text>还没有记录</Text><Text onClick={() => Taro.navigateTo({ url: "/pages/record-form/index" })}>去记第一条</Text></View> :
      dates.map((date) => <View className="records-group" key={date}>
        <Text className="records-date-head">{date} · {dateLabel(date)}</Text>
        {records.filter((record) => record.date === date).map((record) => {
          const Icon = iconFor(record.type);
          const unit = state.units.find((item) => item.id === record.unitId);
          return <View className={`records-row records-${record.type}`} key={record.id} onLongPress={() => remove(record)}>
            <View className="records-type-icon"><Icon size="26" /></View>
            <View className="records-row-copy"><Text className="records-row-title">{(record.data.recordTime as string) || "现场"} · {labels[record.type]}记录</Text><Text className="records-row-meta">{unit?.name || "未知单元"} · {summary(record)}</Text></View>
          </View>;
        })}
      </View>)}
    <AppTabBar active="records" />
  </View>;
}
