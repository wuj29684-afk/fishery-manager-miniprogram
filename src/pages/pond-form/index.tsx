import { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Input, Picker, Text, View } from "@tarojs/components";
import { alertProfiles, inferAlertProfile } from "../../domain/alert-profiles";
import AppTabBar from "../../components/AppTabBar";
import { parseOptionalNumber, validatePondInput } from "../../domain/validation";
import { addPond, loadFarmState, updatePond } from "../../storage/farm-store";
import type { AlertProfileId, FarmUnitType } from "../../types";
import "./index.scss";

const profileIds: AlertProfileId[] = ["shrimp", "tilapia", "cageFish", "general"];
const getPondId = () => Taro.getCurrentInstance().router?.params?.pondId || "";

export default function PondFormPage() {
  const [pondId, setPondId] = useState("");
  const [unitType, setUnitType] = useState<FarmUnitType>("pond");
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [location, setLocation] = useState("");
  const [areaMu, setAreaMu] = useState("");
  const [cageLengthM, setCageLengthM] = useState("");
  const [cageWidthM, setCageWidthM] = useState("");
  const [cageDepthM, setCageDepthM] = useState("");
  const [cageSpecification, setCageSpecification] = useState("");
  const [stockingDate, setStockingDate] = useState("");
  const [stockingQuantity, setStockingQuantity] = useState("");
  const [initialSize, setInitialSize] = useState("");
  const [cultureStage, setCultureStage] = useState("");
  const [targetHarvestDate, setTargetHarvestDate] = useState("");
  const [alertProfileId, setAlertProfileId] = useState<AlertProfileId>("general");
  const [phMin, setPhMin] = useState("");
  const [phMax, setPhMax] = useState("");
  const [oxygenMin, setOxygenMin] = useState("");
  const [ammoniaMax, setAmmoniaMax] = useState("");
  const [nitriteMax, setNitriteMax] = useState("");
  const [saving, setSaving] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [thresholdsOpen, setThresholdsOpen] = useState(false);

  useEffect(() => {
    async function init() {
      const id = getPondId();
      if (!id) return;
      const pond = (await loadFarmState()).ponds.find((item) => item.id === id);
      if (!pond) return;
      setPondId(id); setUnitType(pond.unitType); setName(pond.name); setSpecies(pond.species); setLocation(pond.location); setAreaMu(String(pond.areaMu));
      setCageLengthM(pond.cageLengthM ? String(pond.cageLengthM) : ""); setCageWidthM(pond.cageWidthM ? String(pond.cageWidthM) : "");
      setCageDepthM(pond.cageDepthM ? String(pond.cageDepthM) : ""); setCageSpecification(pond.cageSpecification || "");
      setStockingDate(pond.stockingDate || ""); setStockingQuantity(pond.stockingQuantity ? String(pond.stockingQuantity) : "");
      setInitialSize(pond.initialSize || ""); setCultureStage(pond.cultureStage || ""); setTargetHarvestDate(pond.targetHarvestDate || "");
      setAlertProfileId(pond.alertProfileId); Taro.setNavigationBarTitle({ title: "编辑塘口" });
      setPhMin(pond.customThresholds?.phMin === undefined ? "" : String(pond.customThresholds.phMin));
      setPhMax(pond.customThresholds?.phMax === undefined ? "" : String(pond.customThresholds.phMax));
      setOxygenMin(pond.customThresholds?.dissolvedOxygenMin === undefined ? "" : String(pond.customThresholds.dissolvedOxygenMin));
      setAmmoniaMax(pond.customThresholds?.ammoniaNitrogenMax === undefined ? "" : String(pond.customThresholds.ammoniaNitrogenMax));
      setNitriteMax(pond.customThresholds?.nitriteMax === undefined ? "" : String(pond.customThresholds.nitriteMax));
    }
    init();
  }, []);

  async function save() {
    if (saving) return;
    const quantity = parseOptionalNumber(stockingQuantity, "放苗数量");
    const thresholdResults = [
      parseOptionalNumber(phMin, "pH 下限", 0, 14), parseOptionalNumber(phMax, "pH 上限", 0, 14),
      parseOptionalNumber(oxygenMin, "溶氧下限"), parseOptionalNumber(ammoniaMax, "氨氮上限"), parseOptionalNumber(nitriteMax, "亚硝酸盐上限")
    ];
    const thresholdError = thresholdResults.find((item) => !item.valid);
    const customThresholds = {
      ...(Number.isNaN(thresholdResults[0].value) ? {} : { phMin: thresholdResults[0].value }),
      ...(Number.isNaN(thresholdResults[1].value) ? {} : { phMax: thresholdResults[1].value }),
      ...(Number.isNaN(thresholdResults[2].value) ? {} : { dissolvedOxygenMin: thresholdResults[2].value }),
      ...(Number.isNaN(thresholdResults[3].value) ? {} : { ammoniaNitrogenMax: thresholdResults[3].value }),
      ...(Number.isNaN(thresholdResults[4].value) ? {} : { nitriteMax: thresholdResults[4].value })
    };
    const input = {
      unitType, name: name.trim(), species: species.trim(), location: location.trim(), areaMu: unitType === "pond" && areaMu.trim() ? Number(areaMu) : 0,
      cageLengthM: unitType === "cage" && cageLengthM.trim() ? Number(cageLengthM) : undefined,
      cageWidthM: unitType === "cage" && cageWidthM.trim() ? Number(cageWidthM) : undefined,
      cageDepthM: unitType === "cage" && cageDepthM.trim() ? Number(cageDepthM) : undefined,
      cageSpecification: unitType === "cage" ? cageSpecification.trim() || undefined : undefined,
      stockingDate: stockingDate || undefined,
      stockingQuantity: Number.isNaN(quantity.value) ? undefined : quantity.value,
      initialSize: initialSize.trim() || undefined,
      cultureStage: cultureStage.trim() || undefined,
      alertProfileId,
      customThresholds: Object.keys(customThresholds).length ? customThresholds : undefined,
      targetHarvestDate: targetHarvestDate || undefined,
      legacyStockingDays: undefined
    };
    const validation = validatePondInput(input);
    if (!validation.valid || !quantity.valid || thresholdError) { Taro.showToast({ title: !validation.valid ? validation.message : !quantity.valid ? quantity.message : thresholdError?.message || "预警范围不正确", icon: "none" }); return; }
    setSaving(true);
    try {
      if (pondId) await updatePond(pondId, input); else await addPond(input);
      await Taro.showToast({ title: "保存成功", icon: "success" }); Taro.navigateBack();
    } finally { setSaving(false); }
  }

  return <View className="form-page safe-tab-page">
    <View className="form-head"><Text className="title">{pondId ? "编辑养殖单元" : "新增养殖单元"}</Text><Text className="subtitle">先填写日常管理必需信息，专业设置可后续补充。</Text></View>
    <Text className="form-section-title">类型选择</Text>
    <View className="unit-type-tabs"><Text className={unitType === "pond" ? "active" : ""} onClick={() => { setUnitType("pond"); if (!pondId) setAlertProfileId(inferAlertProfile(species, "pond")); }}>塘口</Text><Text className={unitType === "cage" ? "active" : ""} onClick={() => { setUnitType("cage"); if (!pondId) setAlertProfileId(inferAlertProfile(species, "cage")); }}>网箱</Text></View>
    <Text className="form-section-title">基本信息</Text>
    <View className="form-section">
      <Field label={unitType === "cage" ? "网箱编号" : "塘口名称"} value={name} placeholder={unitType === "pond" ? "例如 3号高位池" : "例如 A区06号网箱"} onInput={setName} />
      <Field label="所属区域" value={location} placeholder={unitType === "pond" ? "例如 南区" : "例如 A区"} onInput={setLocation} />
      <Field label="养殖品种" value={species} placeholder={unitType === "pond" ? "例如 南美白对虾" : "例如 海鲈鱼"} onInput={(value) => { setSpecies(value); if (!pondId) setAlertProfileId(inferAlertProfile(value, unitType)); }} />
      <DateField label={unitType === "pond" ? "放苗日期" : "投放日期"} value={stockingDate} onChange={setStockingDate} />
      {unitType === "pond" ? <Field label="面积（亩）" value={areaMu} placeholder="例如 8.5" type="digit" onInput={setAreaMu} /> : <View className="field compact dimension-field"><Text className="label">网箱尺寸</Text><View className="dimension-inputs"><Input className="dimension-input" type="digit" value={cageLengthM} placeholder="长" onInput={(event) => setCageLengthM(event.detail.value)} /><Text>×</Text><Input className="dimension-input" type="digit" value={cageWidthM} placeholder="宽" onInput={(event) => setCageWidthM(event.detail.value)} /><Text>×</Text><Input className="dimension-input" type="digit" value={cageDepthM} placeholder="深" onInput={(event) => setCageDepthM(event.detail.value)} /><Text>米</Text></View></View>}
      <Field label="投放数量（尾）" value={stockingQuantity} placeholder="例如 10000" type="number" onInput={setStockingQuantity} />
    </View>
    <View className="advanced-toggle" onClick={() => setAdvancedOpen(!advancedOpen)}><View><Text className="advanced-title">补充资料（可选）</Text><Text className="advanced-copy">尺寸、数量、预警范围等可随时补填</Text></View><Text>{advancedOpen ? "收起" : "展开"}</Text></View>
    {advancedOpen && <View className="advanced-fields"><Text className="form-section-title">养殖资料</Text><View className="form-section">
      {unitType === "cage" && <Field label="网箱规格" value={cageSpecification} placeholder="例如 HDPE 圆形网箱" onInput={setCageSpecification} />}
      <Field label="初始规格（克/尾）" value={initialSize} placeholder="例如 0.02" onInput={setInitialSize} />
      <Field label="养殖阶段" value={cultureStage} placeholder="例如 苗期/中期/后期" onInput={setCultureStage} />
      <DateField label="目标出塘日期" value={targetHarvestDate} onChange={setTargetHarvestDate} />
      <Picker mode="selector" range={profileIds.map((id) => alertProfiles[id].name)} value={profileIds.indexOf(alertProfileId)} onChange={(event) => setAlertProfileId(profileIds[Number(event.detail.value)])}><View className="pond-picker"><Text className="label">水质预警模板</Text><Text className="picker-value">{alertProfiles[alertProfileId].name}</Text></View></Picker>
      </View>
      <View className="advanced-toggle threshold-toggle" onClick={() => setThresholdsOpen(!thresholdsOpen)}><Text>自定义预警范围（按需填写）</Text><Text>{thresholdsOpen ? "收起" : "展开"}</Text></View>
      {thresholdsOpen && <View className="threshold-fields form-section"><View className="field-row"><Field label="pH 下限" value={phMin} placeholder="使用模板" type="digit" onInput={setPhMin} /><Field label="pH 上限" value={phMax} placeholder="使用模板" type="digit" onInput={setPhMax} /></View><View className="field-row"><Field label="溶氧下限" value={oxygenMin} placeholder="使用模板" type="digit" onInput={setOxygenMin} /><Field label="氨氮上限" value={ammoniaMax} placeholder="使用模板" type="digit" onInput={setAmmoniaMax} /></View><Field label="亚硝酸盐上限" value={nitriteMax} placeholder="使用模板" type="digit" onInput={setNitriteMax} /></View>}
    </View>}
    <Text className="hint">预警模板为养殖参考范围，可在后续按养殖单元调整。</Text>
    <Text className="save-button" onClick={save}>{saving ? "保存中..." : "保存养殖单元"}</Text>
    <Text className="cancel-button" onClick={() => Taro.navigateBack()}>取消</Text>
    <AppTabBar active="units" />
  </View>;
}

function Field(props: { label: string; value: string; placeholder: string; type?: "text" | "number" | "digit"; onInput(value: string): void }) {
  return <View className="field compact"><Text className="label">{props.label}</Text><Input className="input" type={props.type || "text"} value={props.value} placeholder={props.placeholder} onInput={(event) => props.onInput(event.detail.value)} /></View>;
}

function DateField(props: { label: string; value: string; onChange(value: string): void }) {
  return <Picker mode="date" value={props.value} onChange={(event) => props.onChange(event.detail.value)}><View className="field compact"><Text className="label">{props.label}</Text><Text className={`picker-value ${props.value ? "" : "placeholder"}`}>{props.value || "请选择日期"}</Text></View></Picker>;
}
