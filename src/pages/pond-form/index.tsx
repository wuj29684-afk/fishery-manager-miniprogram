import { useState } from "react";
import Taro from "@tarojs/taro";
import { Image, Input, Picker, Text, View } from "@tarojs/components";
import { ArrowLeft, Checked } from "@taroify/icons";
import AppTabBar from "../../components/AppTabBar";
import seaCagePhoto from "../../assets/sea-cage-photo.jpg";
import indoorRasTanks from "../../assets/indoor-ras-tanks.jpg";
import otherEcoAquaculture from "../../assets/other-eco-aquaculture.jpg";
import outdoorPondPhoto from "../../assets/outdoor-pond-photo.jpg";
import { createFarm, createUnit, startBatch } from "../../v4/state";
import { formatLocalDate } from "../../v4/date";
import { loadV4State, saveV4State } from "../../v4/store";
import type { UnitType } from "../../v4/types";
import "./index.scss";

const unitTypes: Array<{ value: UnitType; label: string; detail: string; image: string }> = [
  { value: "cage", label: "网箱", detail: "适合湖泊、水库、海上网箱养殖", image: seaCagePhoto },
  { value: "pond", label: "塘口", detail: "土塘、池塘等传统养殖", image: outdoorPondPhoto },
  { value: "tank", label: "室内池", detail: "工厂化、室内循环水养殖", image: indoorRasTanks },
  { value: "other", label: "其他", detail: "稻渔、流水槽等养殖单元", image: otherEcoAquaculture }
];

export default function PondFormPage() {
  const initial = loadV4State();
  const [farmName, setFarmName] = useState(initial.farms.length ? "" : "我的养殖场");
  const [unitName, setUnitName] = useState("");
  const [location, setLocation] = useState("");
  const [typeIndex, setTypeIndex] = useState(0);
  const [species, setSpecies] = useState("");
  const [stockingDate, setStockingDate] = useState(formatLocalDate());
  const [quantity, setQuantity] = useState("");
  const [area, setArea] = useState("");
  const [saving, setSaving] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const needsFarm = !initial.farms.length;

  async function save() {
    if (saving) return;
    if ((needsFarm && !farmName.trim()) || !unitName.trim() || !species.trim()) {
      await Taro.showToast({ title: "请填写名称和养殖品种", icon: "none" });
      return;
    }
    setSaving(true);
    try {
      let state = loadV4State();
      const actorId = state.auth.userId || "local-user";
      if (!state.farms.length) {
        state = createFarm(state, { name: farmName.trim(), province: "", city: "", district: "" }, actorId);
      }
      const farmId = state.settings.selectedFarmId || state.farms[0].id;
      const type = unitTypes[typeIndex].value;
      state = createUnit(state, {
        farmId,
        type,
        name: unitName.trim(),
        location: location.trim(),
        ...(type === "pond" && Number(area) > 0 ? { areaMu: Number(area) } : {})
      }, actorId);
      const unitId = state.settings.selectedUnitId;
      state = startBatch(state, {
        farmId,
        unitId,
        species: species.trim(),
        stockingDate,
        ...(Number(quantity) > 0 ? { stockingQuantity: Number(quantity) } : {})
      }, actorId);
      saveV4State(state);
      await Taro.showToast({ title: "养殖单元已创建", icon: "success" });
      Taro.redirectTo({ url: `/pages/pond-detail/index?id=${unitId}` });
    } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : "保存失败", icon: "none" });
    } finally {
      setSaving(false);
    }
  }

  return <View className="form-page safe-tab-page">
    <View className="form-head"><ArrowLeft size="22" onClick={() => Taro.navigateBack()} /><Text className="title">创建养殖单元</Text><View className="head-spacer" /></View>
    <View className="step-line"><Text className="active">1</Text><View /><Text className={step === 2 ? "active" : ""}>2</Text></View>
    <View className="step-labels"><Text>类型选择</Text><Text>基本信息</Text></View>

    {step === 1 ? <><Text className="form-section-title">选择养殖类型</Text>
    <View className="unit-type-list">
      {unitTypes.map((item, index) => <View className={`unit-type-card ${typeIndex === index ? "active" : ""}`} key={item.value} onClick={() => setTypeIndex(index)}>
        <Image src={item.image} mode="aspectFill" />
        <View><Text className="type-name">{item.label}</Text><Text className="type-detail">{item.detail}</Text></View>
        {typeIndex === index && <Checked className="type-check" size="24" />}
      </View>)}
    </View></> : <><Text className="form-section-title">基本信息</Text>
    <View className="form-section">
      {needsFarm && <View className="field"><Text className="label">养殖场</Text><Input className="input" value={farmName} placeholder="我的养殖场" onInput={(e) => setFarmName(e.detail.value)} /></View>}
      <View className="field"><Text className="label">单元名称</Text><Input className="input" value={unitName} placeholder="例如：1号南美白对虾池" onInput={(e) => setUnitName(e.detail.value)} /></View>
      <View className="field"><Text className="label">所在位置</Text><Input className="input" value={location} placeholder="例如：东区" onInput={(e) => setLocation(e.detail.value)} /></View>
      <View className="field"><Text className="label">养殖品种</Text><Input className="input" value={species} placeholder="例如：南美白对虾" onInput={(e) => setSpecies(e.detail.value)} /></View>
      <Picker mode="date" value={stockingDate} onChange={(e) => setStockingDate(e.detail.value)}>
        <View className="field"><Text className="label">投放日期</Text><Text className="picker-value">{stockingDate}</Text></View>
      </Picker>
      <View className="field"><Text className="label">投放数量</Text><Input className="input" type="number" value={quantity} placeholder="可选" onInput={(e) => setQuantity(e.detail.value)} /><Text className="unit-suffix">尾</Text></View>
      {unitTypes[typeIndex].value === "pond" && <View className="field"><Text className="label">面积</Text><Input className="input" type="digit" value={area} placeholder="可选" onInput={(e) => setArea(e.detail.value)} /><Text className="unit-suffix">亩</Text></View>}
    </View></>}
    <View className="create-actions">
      {step === 2 && <Text className="back-button" onClick={() => setStep(1)}>上一步</Text>}
      <Text className="save-button" onClick={step === 1 ? () => setStep(2) : save}>{step === 1 ? "下一步" : saving ? "正在创建..." : "创建并进入单元"}</Text>
    </View>
    <AppTabBar active="units" />
  </View>;
}
