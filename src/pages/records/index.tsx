import { useEffect, useMemo, useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Picker, Text, View } from "@tarojs/components";
import { BagOutlined, BarChartOutlined, BulbOutlined, CouponOutlined, GoldCoinOutlined, RecordsOutlined, WarningOutlined } from "@taroify/icons";
import AppTabBar from "../../components/AppTabBar";
import { getRecordTitle } from "../../domain/operations";
import { loadFarmState } from "../../storage/farm-store";
import type { FarmState, RecordType } from "../../types";
import "./index.scss";

const filters: Array<{ value: "all" | RecordType; label: string }> = [
  { value: "all", label: "全部" }, { value: "feed", label: "投料" }, { value: "water", label: "水质" },
  { value: "drug", label: "用药" }, { value: "harvest", label: "收获" }, { value: "sampling", label: "抽样" },
  { value: "mortality", label: "死亡" }, { value: "expense", label: "支出" }
];

const recordIcons = {
  feed: BagOutlined,
  water: BulbOutlined,
  drug: CouponOutlined,
  harvest: BarChartOutlined,
  sampling: RecordsOutlined,
  mortality: WarningOutlined,
  expense: GoldCoinOutlined
};

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

  const groups = useMemo(() => records.reduce<Array<{ date: string; items: typeof records }>>((result, record) => {
    const group = result[result.length - 1];
    if (group?.date === record.date) group.items.push(record);
    else result.push({ date: record.date, items: [record] });
    return result;
  }, []), [records]);

  if (!state) return <View className="records-page"><Text>正在读取记录...</Text></View>;
  const pondOptions = [{ id: "all", name: "全部养殖单元" }, ...state.ponds];
  const pondIndex = Math.max(0, pondOptions.findIndex((pond) => pond.id === pondId));
  const typeIndex = Math.max(0, filters.findIndex((item) => item.value === type));

  return <View className="records-page safe-tab-page">
    <View className="records-head"><Text className="records-title">记录列表</Text><Text className="records-count">{records.length} 条</Text></View>
    <View className="records-filter-row"><Picker mode="selector" range={pondOptions.map((pond) => pond.name)} value={pondIndex} onChange={(event) => setPondId(pondOptions[Number(event.detail.value)].id)}><View className="records-picker"><Text>{pondOptions[pondIndex].name}</Text></View></Picker><Picker mode="selector" range={filters.map((item) => item.label)} value={typeIndex} onChange={(event) => setType(filters[Number(event.detail.value)].value)}><View className="records-picker"><Text>{filters[typeIndex].label}类型</Text></View></Picker><View className="records-picker"><Text>近7天</Text></View></View>
    {groups.length ? groups.map((group) => <View className="records-group" key={group.date}><Text className="records-date-head">{group.date}</Text>{group.items.map((record) => { const Icon = recordIcons[record.type]; return <View className={`records-row records-${record.type}`} key={record.id} onClick={() => Taro.navigateTo({ url: `/pages/record-form/index?recordId=${record.id}` })}><View className="records-type-icon"><Icon size="21" /></View><View className="records-row-copy"><Text className="records-row-title">{getRecordTitle(record)}</Text><Text className="records-row-meta">{state.ponds.find((pond) => pond.id === record.pondId)?.name || "已删除塘口"} · {record.note || "无备注"}</Text></View><Text className="records-row-date">编辑</Text></View>; })}</View>) : <View className="records-empty"><Text>还没有符合条件的记录</Text></View>}
    <Text className="settings-title">数据与设置</Text>
    <View className="settings-list"><View onClick={() => Taro.navigateTo({ url: "/pages/data-backup/index" })}><Text>账号与数据同步</Text><Text>管理登录账号与同步</Text></View><View onClick={() => Taro.navigateTo({ url: "/pages/data-backup/index" })}><Text>数据备份与导出</Text><Text>备份塘口和记录</Text></View><View onClick={() => Taro.navigateTo({ url: "/pages/data-backup/index" })}><Text>预警设置</Text><Text>管理水质阈值</Text></View><View onClick={() => Taro.navigateTo({ url: "/pages/units/index" })}><Text>养殖单元管理</Text><Text>添加、编辑养殖单元</Text></View><View onClick={() => Taro.navigateTo({ url: "/pages/about-data/index" })}><Text>关于渔儿小助手</Text><Text>版本与帮助</Text></View></View>
    <AppTabBar active="records" />
  </View>;
}
