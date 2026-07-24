import { useMemo, useState } from "react";
import Taro from "@tarojs/taro";
import { Image, Input, Picker, Switch, Text, Textarea, View } from "@tarojs/components";
import { ArrowLeft, Bag, BillOutlined, Certificate, Fire, Points, RecordsOutlined, ShopOutlined, Warning } from "@taroify/icons";
import AppTabBar from "../../components/AppTabBar";
import seaCagePhoto from "../../assets/sea-cage-photo.jpg";
import indoorRasTanks from "../../assets/indoor-ras-tanks.jpg";
import otherEcoAquaculture from "../../assets/other-eco-aquaculture.jpg";
import outdoorPondPhoto from "../../assets/outdoor-pond-photo.jpg";
import { consumeInventory, convertWeightToKg } from "../../v4/inventory";
import { addV4Record } from "../../v4/state";
import { loadV4State, saveV4State } from "../../v4/store";
import type { V4RecordType, WeightUnit } from "../../v4/types";
import "./index.scss";

const types: Array<{ value: V4RecordType; label: string; Icon: typeof Bag; tone: string }> = [
  { value: "feed", label: "投喂", Icon: Bag, tone: "green" },
  { value: "water", label: "水质", Icon: Points, tone: "blue" },
  { value: "patrol", label: "巡塘异常", Icon: Warning, tone: "orange" },
  { value: "drug", label: "用药", Icon: Certificate, tone: "red" },
  { value: "sampling", label: "抽样", Icon: RecordsOutlined, tone: "green" },
  { value: "mortality", label: "死亡", Icon: Fire, tone: "blue" },
  { value: "harvest", label: "收获", Icon: ShopOutlined, tone: "blue" },
  { value: "expense", label: "经营支出", Icon: BillOutlined, tone: "orange" },
  { value: "custom", label: "自定义", Icon: RecordsOutlined, tone: "purple" }
];

const route = () => Taro.getCurrentInstance().router?.params || {};
const labelOf = (type: V4RecordType) => types.find((item) => item.value === type)?.label || "记录";

export default function RecordFormPage() {
  const state = loadV4State();
  const routeType = types.find((item) => item.value === route().type)?.value;
  const [selectedType, setSelectedType] = useState<V4RecordType | null>(routeType || null);
  const activeBatches = useMemo(() => state.batches.filter((batch) => batch.status !== "completed"), [state.batches]);
  const initialBatch = activeBatches.findIndex((batch) => batch.unitId === route().unitId);
  const [batchIndex, setBatchIndex] = useState(Math.max(0, initialBatch));
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [time, setTime] = useState(new Date().toTimeString().slice(0, 5));
  const [amount, setAmount] = useState("");
  const [secondary, setSecondary] = useState("");
  const [third, setThird] = useState("");
  const [productName, setProductName] = useState("");
  const [fourth, setFourth] = useState("");
  const [fifth, setFifth] = useState("");
  const [sixth, setSixth] = useState("");
  const [note, setNote] = useState("");
  const [abnormal, setAbnormal] = useState(false);
  const [advanced, setAdvanced] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weightUnit, setWeightUnit] = useState<WeightUnit>(state.settings.weightUnit);
  const batch = activeBatches[batchIndex];
  const unit = state.units.find((item) => item.id === batch?.unitId);
  const stockItems = state.inventory.filter((item) => item.farmId === batch?.farmId && (selectedType === "feed" ? item.kind === "feed" : selectedType === "drug" ? item.kind === "drug" : false));
  const [stockIndex, setStockIndex] = useState(0);

  if (!selectedType) {
    return <View className="quick-page safe-tab-page">
      <Text className="title">快记</Text>
      {unit && <View className="quick-current"><Image src={unit.type === "cage" ? seaCagePhoto : unit.type === "tank" ? indoorRasTanks : unit.type === "other" ? otherEcoAquaculture : outdoorPondPhoto} mode="aspectFill" /><View><Text>{unit.name}</Text><Text>{batch?.species || "当前养殖单元"}</Text></View></View>}
      <Text className="form-section-title">常用记录</Text>
      <View className="quick-main-grid">{types.slice(0, 4).map(({ value, label, Icon, tone }) => <View className={`quick-tile tile-${tone}`} key={value} onClick={() => setSelectedType(value)}><Icon size="38" /><Text>{label}</Text><Text>快速记录</Text></View>)}</View>
      <Text className="form-section-title">更多记录</Text>
      <View className="quick-more-grid">{types.slice(4).map(({ value, label, Icon }) => <View key={value} onClick={() => setSelectedType(value)}><Icon size="26" /><Text>{label}</Text></View>)}</View>
      <AppTabBar active="quick" />
    </View>;
  }
  const currentType: V4RecordType = selectedType;

  function buildData(): Record<string, unknown> {
    const value = Number(amount);
    const other = Number(secondary);
    const extra = Number(third);
    if (currentType === "feed") return { feedName: productName, weightKg: convertWeightToKg(value, weightUnit), method: secondary, timesPerDay: extra || undefined };
    if (currentType === "water") return { temperatureC: value, dissolvedOxygenMgL: other, ph: extra, ammoniaNitrogenMgL: Number(fourth), nitriteMgL: Number(fifth), transparencyCm: Number(sixth) };
    if (currentType === "sampling") return { averageWeightG: value, estimatedStockQuantity: other };
    if (currentType === "mortality") return { count: value, reason: note };
    if (currentType === "harvest") return { weightKg: convertWeightToKg(value, weightUnit), unitPriceYuan: other };
    if (currentType === "expense") return { amountYuan: value, category: secondary || "其他" };
    if (currentType === "drug") return { medicineName: productName, amount: value, costYuan: other, withdrawalDays: extra };
    if (currentType === "patrol") return { abnormal, severity: abnormal ? "warning" : "normal" };
    return { value: amount, extra: secondary, abnormal };
  }

  async function save() {
    if (saving || !batch) return;
    if (selectedType !== "patrol" && selectedType !== "custom" && amount.trim() === "") {
      await Taro.showToast({ title: "请填写主要数值", icon: "none" });
      return;
    }
    setSaving(true);
    try {
      let next = loadV4State();
      const actorId = next.auth.userId || "local-user";
      const selectedStock = stockItems[stockIndex];
      const consumedKg = selectedType === "feed" ? convertWeightToKg(Number(amount), weightUnit) : selectedType === "drug" ? Number(amount) : 0;
      if (selectedStock && consumedKg > 0) next = consumeInventory(next, selectedStock.id, consumedKg, batch.id, actorId);
      next = addV4Record(next, {
        farmId: batch.farmId,
        unitId: batch.unitId,
        batchId: batch.id,
        type: currentType,
        date,
        note,
        data: { ...buildData(), recordTime: time, ...(selectedStock ? { inventoryItemId: selectedStock.id, unitCostYuan: selectedStock.averageUnitCostYuan } : {}) }
      }, actorId);
      saveV4State({ ...next, settings: { ...next.settings, weightUnit } });
      await Taro.showToast({ title: "记录已保存", icon: "success" });
      Taro.redirectTo({ url: "/pages/records/index" });
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
    } finally {
      setSaving(false);
    }
  }

  if (!activeBatches.length) return <View className="record-page safe-tab-page"><Text className="title">{labelOf(selectedType)}记录</Text><View className="empty-state"><Text>暂无进行中的养殖批次</Text><Text className="fm-primary" onClick={() => Taro.navigateTo({ url: "/pages/pond-form/index" })}>创建养殖单元</Text></View><AppTabBar active="quick" /></View>;

  const art = unit?.type === "cage" ? seaCagePhoto
    : unit?.type === "tank" ? indoorRasTanks
      : unit?.type === "other" ? otherEcoAquaculture
        : outdoorPondPhoto;
  return <View className="record-page safe-tab-page">
    <View className="record-nav"><ArrowLeft size="22" onClick={() => Taro.navigateBack()} /><Text>{labelOf(selectedType)}记录</Text><View /></View>
    <Picker mode="selector" range={activeBatches.map((item) => `${state.units.find((u) => u.id === item.unitId)?.name || "单元"} · ${item.species}`)} value={batchIndex} onChange={(e) => setBatchIndex(Number(e.detail.value))}>
      <View className="form-unit-preview"><Image src={art} mode="aspectFill" /><View><Text className="preview-name">{unit?.name}</Text><Text className="preview-meta">{batch?.species} · 点击切换</Text></View></View>
    </Picker>
    <View className="field-section">
      <Picker mode="date" value={date} onChange={(e) => setDate(e.detail.value)}><View className="field"><Text className="label">{labelOf(selectedType)}日期</Text><Text className="picker-value">{date}</Text></View></Picker>
      <Picker mode="time" value={time} onChange={(e) => setTime(e.detail.value)}><View className="field"><Text className="label">记录时间</Text><Text className="picker-value">{time}</Text></View></Picker>
      {["feed", "drug"].includes(selectedType) && <View className="field"><Text className="label">{selectedType === "feed" ? "投喂饲料" : "药品名称"}</Text><Input className="input" value={productName} placeholder="请选择或输入" onInput={(e) => setProductName(e.detail.value)} /></View>}
      {selectedType !== "patrol" && <View className="field"><Text className="label">{selectedType === "expense" ? "支出金额" : selectedType === "mortality" ? "死亡数量" : selectedType === "water" ? "水温" : selectedType === "drug" ? "用量" : "主要数值"}</Text><Input className="input" type="digit" value={amount} placeholder="请输入" onInput={(e) => setAmount(e.detail.value)} /></View>}
      {["feed", "water", "sampling", "harvest", "drug", "expense"].includes(selectedType) && <View className="field"><Text className="label">{selectedType === "feed" ? "投喂方式" : selectedType === "water" ? "溶氧" : selectedType === "sampling" ? "估算存塘量" : selectedType === "harvest" ? "销售单价" : selectedType === "drug" ? "药品成本" : "支出分类"}</Text><Input className="input" type={["feed", "expense"].includes(selectedType) ? "text" : "digit"} value={secondary} placeholder="请输入" onInput={(e) => setSecondary(e.detail.value)} /></View>}
      {["feed", "water", "drug"].includes(selectedType) && <View className="field"><Text className="label">{selectedType === "feed" ? "投喂次数" : selectedType === "water" ? "pH 值" : "休药天数"}</Text><Input className="input" type="digit" value={third} placeholder="可选" onInput={(e) => setThird(e.detail.value)} /></View>}
      {selectedType === "water" && <>
        <View className="field"><Text className="label">氨氮</Text><Input className="input" type="digit" value={fourth} placeholder="mg/L" onInput={(e) => setFourth(e.detail.value)} /></View>
        <View className="field"><Text className="label">亚硝酸盐</Text><Input className="input" type="digit" value={fifth} placeholder="mg/L" onInput={(e) => setFifth(e.detail.value)} /></View>
        <View className="field"><Text className="label">透明度</Text><Input className="input" type="digit" value={sixth} placeholder="cm" onInput={(e) => setSixth(e.detail.value)} /></View>
      </>}
      {selectedType === "patrol" && <View className="field"><Text className="label">发现异常</Text><Switch checked={abnormal} onChange={(e) => setAbnormal(e.detail.value)} /></View>}
    </View>
    {["feed", "harvest"].includes(selectedType) && <View className="weight-switch"><Text>重量单位</Text><Text className={weightUnit === "jin" ? "active" : ""} onClick={() => setWeightUnit("jin")}>斤</Text><Text className={weightUnit === "kg" ? "active" : ""} onClick={() => setWeightUnit("kg")}>公斤</Text></View>}
    {stockItems.length > 0 && <Picker mode="selector" range={stockItems.map((item) => `${item.name} · ${item.quantityKg} kg`)} value={stockIndex} onChange={(e) => setStockIndex(Number(e.detail.value))}><View className="expand-button">关联库存：{stockItems[stockIndex]?.name}</View></Picker>}
    <View className="expand-button" onClick={() => setAdvanced(!advanced)}>专业参数（可选） {advanced ? "收起" : "展开"}</View>
    {advanced && <View className="field-section extra-section"><View className="field note-field"><Text className="label">备注</Text><Textarea className="textarea" value={note} placeholder="现场情况、批次或操作说明" onInput={(e) => setNote(e.detail.value)} /></View></View>}
    <View className="form-actions"><Text className="continue-button" onClick={() => Taro.navigateBack()}>保存草稿</Text><Text className="save-button" onClick={save}>{saving ? "保存中..." : "保存记录"}</Text></View>
    <AppTabBar active="quick" />
  </View>;
}
