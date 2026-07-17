import { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Input, Picker, Text, View } from "@tarojs/components";
import { alertProfiles, inferAlertProfile } from "../../domain/alert-profiles";
import { parseOptionalNumber, validatePondInput } from "../../domain/validation";
import { addPond, loadFarmState, updatePond } from "../../storage/farm-store";
import type { AlertProfileId } from "../../types";
import "./index.scss";

const profileIds: AlertProfileId[] = ["shrimp", "tilapia", "general"];
const getPondId = () => Taro.getCurrentInstance().router?.params?.pondId || "";

export default function PondFormPage() {
  const [pondId, setPondId] = useState("");
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [location, setLocation] = useState("");
  const [areaMu, setAreaMu] = useState("");
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

  useEffect(() => {
    async function init() {
      const id = getPondId();
      if (!id) return;
      const pond = (await loadFarmState()).ponds.find((item) => item.id === id);
      if (!pond) return;
      setPondId(id); setName(pond.name); setSpecies(pond.species); setLocation(pond.location); setAreaMu(String(pond.areaMu));
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
      name: name.trim(), species: species.trim(), location: location.trim(), areaMu: Number(areaMu),
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

  return <View className="form-page">
    <View className="form-head"><Text className="title">{pondId ? "编辑塘口" : "新增塘口"}</Text><Text className="subtitle">建立养殖批次后，养殖天数和经营指标会自动计算。</Text></View>
    <Field label="塘口名称" value={name} placeholder="例如 3号高位池" onInput={setName} />
    <Field label="养殖品种" value={species} placeholder="例如 南美白对虾" onInput={(value) => { setSpecies(value); if (!pondId) setAlertProfileId(inferAlertProfile(value)); }} />
    <Field label="所在位置" value={location} placeholder="例如 广东湛江 麻章区" onInput={setLocation} />
    <View className="field-row"><Field label="面积（亩）" value={areaMu} placeholder="8.5" type="digit" onInput={setAreaMu} /><DateField label="放苗日期" value={stockingDate} onChange={setStockingDate} /></View>
    <View className="field-row"><Field label="放苗数量（尾）" value={stockingQuantity} placeholder="50000" type="number" onInput={setStockingQuantity} /><Field label="初始规格（克/尾）" value={initialSize} placeholder="0.02" onInput={setInitialSize} /></View>
    <View className="field-row"><Field label="养殖阶段" value={cultureStage} placeholder="苗期/中期/后期" onInput={setCultureStage} /><DateField label="目标出塘日期" value={targetHarvestDate} onChange={setTargetHarvestDate} /></View>
    <Picker mode="selector" range={profileIds.map((id) => alertProfiles[id].name)} value={profileIds.indexOf(alertProfileId)} onChange={(event) => setAlertProfileId(profileIds[Number(event.detail.value)])}><View className="pond-picker"><Text className="label">水质预警模板</Text><Text className="picker-value">{alertProfiles[alertProfileId].name}</Text></View></Picker>
    <View className="advanced-toggle" onClick={() => setAdvancedOpen(!advancedOpen)}><Text>高级预警范围（可选）</Text><Text>{advancedOpen ? "收起" : "展开"}</Text></View>
    {advancedOpen && <View className="advanced-fields"><View className="field-row"><Field label="pH 下限" value={phMin} placeholder="使用模板" type="digit" onInput={setPhMin} /><Field label="pH 上限" value={phMax} placeholder="使用模板" type="digit" onInput={setPhMax} /></View><View className="field-row"><Field label="溶氧下限" value={oxygenMin} placeholder="使用模板" type="digit" onInput={setOxygenMin} /><Field label="氨氮上限" value={ammoniaMax} placeholder="使用模板" type="digit" onInput={setAmmoniaMax} /></View><Field label="亚硝酸盐上限" value={nitriteMax} placeholder="使用模板" type="digit" onInput={setNitriteMax} /></View>}
    <Text className="hint">预警模板为养殖参考范围，可在后续数据设置中按塘口调整。</Text>
    <Text className="save-button" onClick={save}>{saving ? "保存中..." : "保存塘口"}</Text>
  </View>;
}

function Field(props: { label: string; value: string; placeholder: string; type?: "text" | "number" | "digit"; onInput(value: string): void }) {
  return <View className="field compact"><Text className="label">{props.label}</Text><Input className="input" type={props.type || "text"} value={props.value} placeholder={props.placeholder} onInput={(event) => props.onInput(event.detail.value)} /></View>;
}

function DateField(props: { label: string; value: string; onChange(value: string): void }) {
  return <Picker mode="date" value={props.value} onChange={(event) => props.onChange(event.detail.value)}><View className="field compact"><Text className="label">{props.label}</Text><Text className={`picker-value ${props.value ? "" : "placeholder"}`}>{props.value || "请选择日期"}</Text></View></Picker>;
}
