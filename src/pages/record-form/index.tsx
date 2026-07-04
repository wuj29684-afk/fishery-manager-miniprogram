import { useEffect, useMemo, useState } from "react";
import Taro from "@tarojs/taro";
import { Input, Picker, Text, Textarea, View } from "@tarojs/components";
import { todayString } from "../../domain/format";
import { labelForRecordType, parseRequiredNumber } from "../../domain/validation";
import { addRecord, deleteRecord, loadFarmState, updateRecord } from "../../storage/farm-store";
import type { FarmRecord, FarmRecordInput, Pond, RecordType } from "../../types";
import "./index.scss";

const recordTypes: RecordType[] = ["feed", "water", "drug", "harvest"];

function getRouteType(): RecordType {
  const type = Taro.getCurrentInstance().router?.params?.type;
  return recordTypes.includes(type as RecordType) ? (type as RecordType) : "feed";
}

function getRoutePondId(): string {
  return Taro.getCurrentInstance().router?.params?.pondId ?? "";
}

function getRouteRecordId(): string {
  return Taro.getCurrentInstance().router?.params?.recordId ?? "";
}

export default function RecordFormPage() {
  const [recordId, setRecordId] = useState("");
  const [ponds, setPonds] = useState<Pond[]>([]);
  const [pondId, setPondId] = useState("");
  const [type, setType] = useState<RecordType>(getRouteType());
  const [date, setDate] = useState(todayString());
  const [note, setNote] = useState("");
  const [weightKg, setWeightKg] = useState("");
  const [unitPriceYuan, setUnitPriceYuan] = useState("");
  const [ph, setPh] = useState("");
  const [dissolvedOxygen, setDissolvedOxygen] = useState("");
  const [ammoniaNitrogen, setAmmoniaNitrogen] = useState("");
  const [drugName, setDrugName] = useState("");
  const [dosage, setDosage] = useState("");
  const [withdrawalDays, setWithdrawalDays] = useState("");
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(recordId);

  useEffect(() => {
    async function init() {
      const state = await loadFarmState();
      const routePondId = getRoutePondId();
      const routeRecordId = getRouteRecordId();
      const editingRecord = state.records.find((record) => record.id === routeRecordId);
      setPonds(state.ponds);
      if (editingRecord) {
        setRecordId(editingRecord.id);
        fillForm(editingRecord);
        Taro.setNavigationBarTitle({ title: "编辑记录" });
      } else {
        setPondId(routePondId || state.ponds[0]?.id || "");
      }
    }
    init();
  }, []);

  const pondNames = useMemo(() => ponds.map((pond) => pond.name), [ponds]);
  const pondIndex = Math.max(0, ponds.findIndex((pond) => pond.id === pondId));

  function showMessage(message: string) {
    Taro.showToast({ title: message, icon: "none" });
  }

  function fillForm(record: FarmRecord) {
    setPondId(record.pondId);
    setType(record.type);
    setDate(record.date);
    setNote(record.note);
    setWeightKg("");
    setUnitPriceYuan("");
    setPh("");
    setDissolvedOxygen("");
    setAmmoniaNitrogen("");
    setDrugName("");
    setDosage("");
    setWithdrawalDays("");

    if (record.type === "feed" || record.type === "harvest") {
      setWeightKg(String(record.weightKg));
      setUnitPriceYuan(String(record.unitPriceYuan));
    } else if (record.type === "water") {
      setPh(String(record.ph));
      setDissolvedOxygen(String(record.dissolvedOxygen));
      setAmmoniaNitrogen(String(record.ammoniaNitrogen));
    } else {
      setDrugName(record.drugName);
      setDosage(record.dosage);
      setWithdrawalDays(String(record.withdrawalDays));
    }
  }

  function buildRecordInput(): FarmRecordInput | null {
    if (!pondId) {
      showMessage("请先选择塘口");
      return null;
    }
    if (!date.trim()) {
      showMessage("请填写记录日期");
      return null;
    }

    if (type === "feed" || type === "harvest") {
      const weightResult = parseRequiredNumber(weightKg, "重量");
      const priceResult = parseRequiredNumber(unitPriceYuan, "单价");
      if (!weightResult.valid || !priceResult.valid) {
        showMessage(!weightResult.valid ? weightResult.message : priceResult.message);
        return null;
      }
      return {
        pondId,
        type,
        date,
        note,
        weightKg: weightResult.value,
        unitPriceYuan: priceResult.value
      };
    }

    if (type === "water") {
      const phResult = parseRequiredNumber(ph, "pH", 0, 14);
      const oxygenResult = parseRequiredNumber(dissolvedOxygen, "溶氧");
      const ammoniaResult = parseRequiredNumber(ammoniaNitrogen, "氨氮");
      const failed = [phResult, oxygenResult, ammoniaResult].find((item) => !item.valid);
      if (failed) {
        showMessage(failed.message);
        return null;
      }
      return {
        pondId,
        type: "water",
        date,
        note,
        ph: phResult.value,
        dissolvedOxygen: oxygenResult.value,
        ammoniaNitrogen: ammoniaResult.value
      };
    }

    const withdrawalResult = parseRequiredNumber(withdrawalDays, "休药期");
    if (!drugName.trim()) {
      showMessage("请填写药品名称");
      return null;
    }
    if (!dosage.trim()) {
      showMessage("请填写剂量");
      return null;
    }
    if (!withdrawalResult.valid) {
      showMessage(withdrawalResult.message);
      return null;
    }
    return {
      pondId,
      type: "drug",
      date,
      note,
      drugName,
      dosage,
      withdrawalDays: withdrawalResult.value
    };
  }

  async function handleSave() {
    if (saving) return;
    const input = buildRecordInput();
    if (!input) return;

    setSaving(true);
    try {
      if (isEditing) {
        await updateRecord(recordId, input);
      } else {
        await addRecord(input);
      }

      await Taro.showToast({ title: "保存成功", icon: "success" });
      Taro.navigateBack();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!isEditing || saving) return;
    const result = await Taro.showModal({
      title: "删除记录",
      content: "删除后无法恢复，确认删除这条记录吗？",
      confirmText: "删除",
      confirmColor: "#c43d2b"
    });
    if (!result.confirm) return;

    setSaving(true);
    try {
      await deleteRecord(recordId);
      await Taro.showToast({ title: "已删除", icon: "success" });
      Taro.navigateBack();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="form-page">
      <View className="form-head">
        <Text className="title">
          {isEditing ? "编辑" : "新增"}
          {labelForRecordType(type)}记录
        </Text>
        <Text className="subtitle">数据只保存在本机微信小程序本地存储中。</Text>
      </View>

      <View className="record-type-tabs">
        {recordTypes.map((item) => (
          <Text className={`type-tab ${type === item ? "active" : ""}`} key={item} onClick={() => setType(item)}>
            {labelForRecordType(item)}
          </Text>
        ))}
      </View>

      <Picker
        mode="selector"
        range={pondNames}
        value={pondIndex}
        onChange={(event) => setPondId(ponds[Number(event.detail.value)]?.id || pondId)}
      >
        <View className="pond-picker">
          <Text className="label">塘口</Text>
          <Text className="picker-value">{ponds[pondIndex]?.name || "暂无塘口"}</Text>
        </View>
      </Picker>

      <View className="field">
        <Text className="label">日期</Text>
        <Input className="input" value={date} placeholder="YYYY-MM-DD" onInput={(event) => setDate(event.detail.value)} />
      </View>

      {(type === "feed" || type === "harvest") && (
        <View className="field-row">
          <View className="field compact">
            <Text className="label">重量（kg）</Text>
            <Input className="input" type="digit" value={weightKg} placeholder="120" onInput={(event) => setWeightKg(event.detail.value)} />
          </View>
          <View className="field compact">
            <Text className="label">单价（元）</Text>
            <Input className="input" type="digit" value={unitPriceYuan} placeholder="8.5" onInput={(event) => setUnitPriceYuan(event.detail.value)} />
          </View>
        </View>
      )}

      {type === "water" && (
        <>
          <View className="field-row">
            <View className="field compact">
              <Text className="label">pH</Text>
              <Input className="input" type="digit" value={ph} placeholder="8.2" onInput={(event) => setPh(event.detail.value)} />
            </View>
            <View className="field compact">
              <Text className="label">溶氧</Text>
              <Input className="input" type="digit" value={dissolvedOxygen} placeholder="5.0" onInput={(event) => setDissolvedOxygen(event.detail.value)} />
            </View>
          </View>
          <View className="field">
            <Text className="label">氨氮</Text>
            <Input className="input" type="digit" value={ammoniaNitrogen} placeholder="0.2" onInput={(event) => setAmmoniaNitrogen(event.detail.value)} />
          </View>
        </>
      )}

      {type === "drug" && (
        <>
          <View className="field">
            <Text className="label">药品名称</Text>
            <Input className="input" value={drugName} placeholder="例如 底改片" onInput={(event) => setDrugName(event.detail.value)} />
          </View>
          <View className="field-row">
            <View className="field compact">
              <Text className="label">剂量</Text>
              <Input className="input" value={dosage} placeholder="2 袋" onInput={(event) => setDosage(event.detail.value)} />
            </View>
            <View className="field compact">
              <Text className="label">休药期（天）</Text>
              <Input className="input" type="number" value={withdrawalDays} placeholder="7" onInput={(event) => setWithdrawalDays(event.detail.value)} />
            </View>
          </View>
        </>
      )}

      <View className="field">
        <Text className="label">备注</Text>
        <Textarea className="textarea" value={note} placeholder="补充现场情况" onInput={(event) => setNote(event.detail.value)} />
      </View>

      <Text className="hint">本版本不上传业务数据，不接入登录、支付或网络请求。</Text>
      <Text className="save-button" onClick={handleSave}>
        {saving ? "保存中..." : "保存记录"}
      </Text>
      {isEditing && (
        <Text className="delete-button" onClick={handleDelete}>
          删除记录
        </Text>
      )}
    </View>
  );
}
