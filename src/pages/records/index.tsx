import { useEffect, useMemo, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Picker, Text, View } from "@tarojs/components";
import { getRecordTitle } from "../../domain/operations";
import { loadFarmState } from "../../storage/farm-store";
import type { FarmState, RecordType } from "../../types";
import "./index.scss";

const filters: Array<{ value: "all" | RecordType; label: string }> = [
  { value: "all", label: "全部" }, { value: "feed", label: "投料" }, { value: "water", label: "水质" },
  { value: "drug", label: "用药" }, { value: "harvest", label: "收获" }, { value: "sampling", label: "抽样" },
  { value: "mortality", label: "死亡" }, { value: "expense", label: "支出" }
];

export default function RecordsPage() {
  const [state, setState] = useState<FarmState | null>(null);
  const [type, setType] = useState<"all" | RecordType>("all");
  const [pondId, setPondId] = useState("all");

  async function refresh() { setState(await loadFarmState()); }
  useEffect(() => { refresh(); }, []);
  useDidShow(() => { refresh(); });

  const records = useMemo(() => {
    if (!state) return [];
    return state.records
      .filter((record) => type === "all" || record.type === type)
      .filter((record) => pondId === "all" || record.pondId === pondId)
      .sort((left, right) => right.date.localeCompare(left.date) || right.updatedAt.localeCompare(left.updatedAt));
  }, [pondId, state, type]);

  if (!state) return <View className="records-page"><Text>正在读取记录...</Text></View>;
  const pondOptions = [{ id: "all", name: "全部塘口" }, ...state.ponds];
  const pondIndex = Math.max(0, pondOptions.findIndex((pond) => pond.id === pondId));

  return <View className="records-page">
    <View className="records-head"><Text className="records-title">经营记录</Text><Text className="records-add" onClick={() => Taro.navigateTo({ url: "/pages/record-form/index?type=feed" })}>新增记录</Text></View>
    <View className="record-filter-tabs">{filters.map((item) => <Text className={`record-filter ${type === item.value ? "active" : ""}`} key={item.value} onClick={() => setType(item.value)}>{item.label}</Text>)}</View>
    <Picker mode="selector" range={pondOptions.map((pond) => pond.name)} value={pondIndex} onChange={(event) => setPondId(pondOptions[Number(event.detail.value)].id)}><View className="records-picker"><Text>{pondOptions[pondIndex].name}</Text><Text>筛选塘口</Text></View></Picker>
    {records.length ? records.map((record) => <View className="records-row" key={record.id} onClick={() => Taro.navigateTo({ url: `/pages/record-form/index?recordId=${record.id}` })}><View><Text className="records-row-title">{getRecordTitle(record)}</Text><Text className="records-row-meta">{state.ponds.find((pond) => pond.id === record.pondId)?.name || "已删除塘口"} · {record.note || "无备注"}</Text></View><Text className="records-row-date">{record.date}</Text></View>) : <View className="records-empty"><Text>还没有符合条件的记录</Text></View>}
  </View>;
}
