import { useEffect, useMemo, useState } from "react";
import Taro from "@tarojs/taro";
import { Input, Picker, Text, Textarea, View } from "@tarojs/components";
import { BagOutlined, BarChartOutlined, BulbOutlined, CouponOutlined, GoldCoinOutlined, RecordsOutlined, WarningOutlined } from "@taroify/icons";
import { todayString } from "../../domain/format";
import { labelForRecordType, parseOptionalNumber, parseRequiredNumber } from "../../domain/validation";
import { hasActiveWithdrawal } from "../../domain/withdrawal";
import { addRecord, deleteRecord, loadFarmState, updateRecord } from "../../storage/farm-store";
import type { ExpenseCategory, FarmRecord, FarmRecordInput, Pond, RecordType } from "../../types";
import "./index.scss";

const recordTypes: RecordType[] = ["feed", "water", "drug", "harvest", "sampling", "mortality", "expense"];
const recordIcons = { feed: BagOutlined, water: BulbOutlined, drug: CouponOutlined, harvest: BarChartOutlined, sampling: RecordsOutlined, mortality: WarningOutlined, expense: GoldCoinOutlined };
const expenseCategories: ExpenseCategory[] = ["seed", "electricity", "labor", "rent", "equipment", "other"];
const expenseLabels = ["苗种", "电费", "人工", "塘租", "设备", "其他"];
const route = () => Taro.getCurrentInstance().router?.params || {};

export default function RecordFormPage() {
  const [recordId, setRecordId] = useState("");
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [pondId, setPondId] = useState("");
  const [type, setType] = useState<RecordType>(recordTypes.includes(route().type as RecordType) ? route().type as RecordType : "feed");
  const [date, setDate] = useState(todayString());
  const [note, setNote] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [expanded, setExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const editing = Boolean(recordId);

  useEffect(() => {
    async function init() {
      const state = await loadFarmState();
      const existing = state.records.find((record) => record.id === route().recordId);
      setPonds(existing ? state.ponds : state.ponds.filter((pond) => pond.status === "active"));
      if (existing) {
        setRecordId(existing.id); setPondId(existing.pondId); setType(existing.type); setDate(existing.date); setNote(existing.note);
        const next: Record<string, string> = {};
        Object.entries(existing).forEach(([key, value]) => { if (!["id", "pondId", "type", "date", "note", "createdAt", "updatedAt"].includes(key) && value !== undefined) next[key] = String(value); });
        setValues(next); Taro.setNavigationBarTitle({ title: "编辑记录" });
      } else setPondId(route().pondId || state.ponds.find((pond) => pond.status === "active")?.id || "");
    }
    init();
  }, []);

  const pondNames = useMemo(() => ponds.map((pond) => pond.name), [ponds]);
  const pondIndex = Math.max(0, ponds.findIndex((pond) => pond.id === pondId));
  const set = (key: string, value: string) => setValues((current) => ({ ...current, [key]: value }));
  const required = (key: string, label: string, min = 0, max = Number.POSITIVE_INFINITY) => parseRequiredNumber(values[key] || "", label, min, max);
  const optional = (key: string, label: string, min = 0, max = Number.POSITIVE_INFINITY) => parseOptionalNumber(values[key] || "", label, min, max);

  function buildInput(): FarmRecordInput | null {
    if (!pondId || !/^\d{4}-\d{2}-\d{2}$/.test(date)) { Taro.showToast({ title: pondId ? "请填写正确记录日期" : "请先选择塘口", icon: "none" }); return null; }
    const base = { pondId, date, note };
    if (type === "feed" || type === "harvest") {
      const weight = required("weightKg", "重量", 0.000001); const price = required("unitPriceYuan", "单价");
      if (!weight.valid || !price.valid) return fail(weight.valid ? price.message : weight.message);
      if (type === "feed") {
        const planned = optional("plannedWeightKg", "计划投喂量");
        return { ...base, type, weightKg: weight.value, unitPriceYuan: price.value, feedName: values.feedName, feedBatch: values.feedBatch, meal: values.meal, plannedWeightKg: Number.isNaN(planned.value) ? undefined : planned.value, appetite: values.appetite as "good" | "normal" | "poor" | undefined, leftover: values.leftover };
      }
      return { ...base, type, weightKg: weight.value, unitPriceYuan: price.value, sizeSpec: values.sizeSpec, buyer: values.buyer };
    }
    if (type === "water") {
      const ph = required("ph", "pH", 0, 14); const oxygen = required("dissolvedOxygen", "溶氧"); const ammonia = required("ammoniaNitrogen", "氨氮");
      const extras = ["temperature", "nitrite", "salinity", "transparencyCm", "alkalinity"].map((key) => optional(key, key));
      const failed = [ph, oxygen, ammonia, ...extras].find((item) => !item.valid); if (failed) return fail(failed.message);
      const value = (index: number) => Number.isNaN(extras[index].value) ? undefined : extras[index].value;
      return { ...base, type, ph: ph.value, dissolvedOxygen: oxygen.value, ammoniaNitrogen: ammonia.value, measuredAt: values.measuredAt, temperature: value(0), nitrite: value(1), salinity: value(2), transparencyCm: value(3), alkalinity: value(4) };
    }
    if (type === "drug") {
      const withdrawal = required("withdrawalDays", "休药期"); const cost = optional("costYuan", "药品成本");
      if (!values.drugName?.trim() || !values.dosage?.trim() || !withdrawal.valid || !cost.valid) return fail(!values.drugName?.trim() ? "请填写药品名称" : !values.dosage?.trim() ? "请填写剂量" : withdrawal.valid ? cost.message : withdrawal.message);
      return { ...base, type, drugName: values.drugName, dosage: values.dosage, withdrawalDays: withdrawal.value, withdrawalEndDate: "", reason: values.reason, activeIngredient: values.activeIngredient, method: values.method, operator: values.operator, costYuan: Number.isNaN(cost.value) ? undefined : cost.value };
    }
    if (type === "sampling") {
      const count = required("sampleCount", "抽样数量", 1); const average = required("averageWeightG", "平均重量", 0.000001); const stock = optional("estimatedStockQuantity", "估算存塘量");
      if (!count.valid || !average.valid || !stock.valid) return fail(!count.valid ? count.message : !average.valid ? average.message : stock.message);
      return { ...base, type, sampleCount: count.value, averageWeightG: average.value, estimatedStockQuantity: Number.isNaN(stock.value) ? undefined : stock.value };
    }
    if (type === "mortality") {
      const count = required("count", "死亡数量", 1); if (!count.valid) return fail(count.message);
      return { ...base, type, count: count.value, suspectedCause: values.suspectedCause, handling: values.handling };
    }
    const amount = required("amountYuan", "支出金额", 0.01);
    if (!values.itemName?.trim() || !amount.valid) return fail(values.itemName?.trim() ? amount.message : "请填写支出项目");
    return { ...base, type: "expense", category: (values.category as ExpenseCategory) || "other", amountYuan: amount.value, itemName: values.itemName };
  }

  function fail(message: string): null { Taro.showToast({ title: message, icon: "none" }); return null; }

  async function save() {
    if (saving) return;
    const input = buildInput(); if (!input) return;
    if (input.type === "harvest") {
      const state = await loadFarmState();
      if (hasActiveWithdrawal(state.records.filter((record) => record.pondId === input.pondId), input.date)) {
        const confirm = await Taro.showModal({ title: "仍在休药期", content: "该塘口在收获日期仍有有效休药期记录。请核对药品说明和当地监管要求，确认仍要保存吗？", confirmText: "仍要保存", confirmColor: "#c43d2b" });
        if (!confirm.confirm) return;
      }
    }
    setSaving(true);
    try { if (editing) await updateRecord(recordId, input); else await addRecord(input); await Taro.showToast({ title: "保存成功", icon: "success" }); Taro.navigateBack(); }
    finally { setSaving(false); }
  }

  async function remove() {
    if (!editing || saving) return;
    const confirm = await Taro.showModal({ title: "删除记录", content: "删除会同步到账号且无法直接恢复，确认删除吗？", confirmText: "删除", confirmColor: "#c43d2b" });
    if (!confirm.confirm) return;
    await deleteRecord(recordId); await Taro.showToast({ title: "已删除", icon: "success" }); Taro.navigateBack();
  }

  return <View className="form-page">
    <View className="form-head"><Text className="title">{editing ? "编辑" : "新增"}{labelForRecordType(type)}记录</Text><Text className="subtitle">核心项优先，专业信息可按需展开。</Text></View>
    {!editing && <View className="record-type-tabs">{recordTypes.map((item) => { const Icon = recordIcons[item]; return <View className={"type-tab " + (type === item ? "active" : "")} key={item} onClick={() => { setType(item); setValues({}); }}><Icon className="type-icon" size="22" /><Text>{labelForRecordType(item)}</Text></View>; })}</View>}
    <Picker mode="selector" range={pondNames} value={pondIndex} onChange={(event) => setPondId(ponds[Number(event.detail.value)]?.id || "")}><View className="pond-picker"><Text className="label">塘口</Text><Text className="picker-value">{ponds[pondIndex]?.name || "暂无可用塘口"}</Text></View></Picker>
    <Picker mode="date" value={date} onChange={(event) => setDate(event.detail.value)}><View className="field"><Text className="label">记录日期</Text><Text className="picker-value">{date}</Text></View></Picker>
    <CoreFields type={type} values={values} set={set} />
    <Text className="expand-button" onClick={() => setExpanded(!expanded)}>{expanded ? "收起专业信息" : "补充专业信息"}</Text>
    {expanded && <ExtraFields type={type} values={values} set={set} />}
    <View className="field"><Text className="label">备注</Text><Textarea className="textarea" value={note} placeholder="补充现场情况" onInput={(event) => setNote(event.detail.value)} /></View>
    <Text className="hint">数据默认保存在本机；仅在用户主动操作时同步到当前微信账号。</Text>
    <Text className="save-button" onClick={save}>{saving ? "保存中..." : "保存记录"}</Text>
    {editing && <Text className="delete-button" onClick={remove}>删除记录</Text>}
  </View>;
}

function CoreFields({ type, values, set }: FieldGroupProps) {
  if (type === "feed" || type === "harvest") return <Row><Field label="重量（kg）" value={values.weightKg} placeholder="120" type="digit" onInput={(v) => set("weightKg", v)} /><Field label="单价（元）" value={values.unitPriceYuan} placeholder="8.5" type="digit" onInput={(v) => set("unitPriceYuan", v)} /></Row>;
  if (type === "water") return <><Row><Field label="pH" value={values.ph} placeholder="8.2" type="digit" onInput={(v) => set("ph", v)} /><Field label="溶氧 mg/L" value={values.dissolvedOxygen} placeholder="5.0" type="digit" onInput={(v) => set("dissolvedOxygen", v)} /></Row><Field label="氨氮 mg/L" value={values.ammoniaNitrogen} placeholder="0.2" type="digit" onInput={(v) => set("ammoniaNitrogen", v)} /></>;
  if (type === "drug") return <><Field label="药品名称" value={values.drugName} placeholder="例如 底改片" onInput={(v) => set("drugName", v)} /><Row><Field label="剂量" value={values.dosage} placeholder="2 袋" onInput={(v) => set("dosage", v)} /><Field label="休药期（天）" value={values.withdrawalDays} placeholder="7" type="number" onInput={(v) => set("withdrawalDays", v)} /></Row></>;
  if (type === "sampling") return <Row><Field label="抽样数量（尾）" value={values.sampleCount} placeholder="30" type="number" onInput={(v) => set("sampleCount", v)} /><Field label="平均重量（克/尾）" value={values.averageWeightG} placeholder="12.5" type="digit" onInput={(v) => set("averageWeightG", v)} /></Row>;
  if (type === "mortality") return <Field label="死亡数量（尾）" value={values.count} placeholder="3" type="number" onInput={(v) => set("count", v)} />;
  return <><Field label="支出项目" value={values.itemName} placeholder="例如 本月电费" onInput={(v) => set("itemName", v)} /><Field label="金额（元）" value={values.amountYuan} placeholder="1200" type="digit" onInput={(v) => set("amountYuan", v)} /><Picker mode="selector" range={expenseLabels} value={Math.max(0, expenseCategories.indexOf(values.category as ExpenseCategory))} onChange={(event) => set("category", expenseCategories[Number(event.detail.value)])}><View className="pond-picker"><Text className="label">支出分类</Text><Text className="picker-value">{expenseLabels[Math.max(0, expenseCategories.indexOf(values.category as ExpenseCategory))]}</Text></View></Picker></>;
}

function ExtraFields({ type, values, set }: FieldGroupProps) {
  if (type === "feed") return <><Row><Field label="饲料名称" value={values.feedName} placeholder="配合饲料" onInput={(v) => set("feedName", v)} /><Field label="饲料批次" value={values.feedBatch} placeholder="批次号" onInput={(v) => set("feedBatch", v)} /></Row><Row><Field label="餐次" value={values.meal} placeholder="早/中/晚" onInput={(v) => set("meal", v)} /><Field label="计划量（kg）" value={values.plannedWeightKg} placeholder="120" type="digit" onInput={(v) => set("plannedWeightKg", v)} /></Row><Field label="摄食与剩料" value={values.leftover} placeholder="摄食正常，无明显剩料" onInput={(v) => set("leftover", v)} /></>;
  if (type === "water") return <><Row><Field label="检测时间" value={values.measuredAt} placeholder="06:30" onInput={(v) => set("measuredAt", v)} /><Field label="水温 ℃" value={values.temperature} placeholder="28" type="digit" onInput={(v) => set("temperature", v)} /></Row><Row><Field label="亚硝酸盐" value={values.nitrite} placeholder="0.1" type="digit" onInput={(v) => set("nitrite", v)} /><Field label="盐度" value={values.salinity} placeholder="15" type="digit" onInput={(v) => set("salinity", v)} /></Row><Row><Field label="透明度 cm" value={values.transparencyCm} placeholder="35" type="digit" onInput={(v) => set("transparencyCm", v)} /><Field label="总碱度" value={values.alkalinity} placeholder="120" type="digit" onInput={(v) => set("alkalinity", v)} /></Row></>;
  if (type === "drug") return <><Field label="用药原因" value={values.reason} placeholder="记录症状或处理目的" onInput={(v) => set("reason", v)} /><Row><Field label="有效成分" value={values.activeIngredient} placeholder="有效成分" onInput={(v) => set("activeIngredient", v)} /><Field label="使用方式" value={values.method} placeholder="泼洒/拌料" onInput={(v) => set("method", v)} /></Row><Row><Field label="操作人" value={values.operator} placeholder="姓名" onInput={(v) => set("operator", v)} /><Field label="药品成本（元）" value={values.costYuan} placeholder="120" type="digit" onInput={(v) => set("costYuan", v)} /></Row></>;
  if (type === "harvest") return <Row><Field label="规格" value={values.sizeSpec} placeholder="30尾/斤" onInput={(v) => set("sizeSpec", v)} /><Field label="销售对象" value={values.buyer} placeholder="收购商" onInput={(v) => set("buyer", v)} /></Row>;
  if (type === "sampling") return <Field label="估算存塘量（尾）" value={values.estimatedStockQuantity} placeholder="45000" type="number" onInput={(v) => set("estimatedStockQuantity", v)} />;
  if (type === "mortality") return <><Field label="疑似原因" value={values.suspectedCause} placeholder="天气、水质或病害表现" onInput={(v) => set("suspectedCause", v)} /><Field label="处理情况" value={values.handling} placeholder="已增氧并复测" onInput={(v) => set("handling", v)} /></>;
  return <Text className="hint">支出分类和金额已构成完整经营成本。</Text>;
}

type FieldGroupProps = { type: RecordType; values: Record<string, string>; set(key: string, value: string): void };
const Row = ({ children }: { children: React.ReactNode }) => <View className="field-row">{children}</View>;
function Field(props: { label: string; value?: string; placeholder: string; type?: "text" | "number" | "digit"; onInput(value: string): void }) {
  return <View className="field compact"><Text className="label">{props.label}</Text><Input className="input" type={props.type || "text"} value={props.value || ""} placeholder={props.placeholder} onInput={(event) => props.onInput(event.detail.value)} /></View>;
}
