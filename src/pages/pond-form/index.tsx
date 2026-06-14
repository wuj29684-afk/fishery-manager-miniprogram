import { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Input, Text, View } from "@tarojs/components";
import { validatePondInput } from "../../domain/validation";
import { addPond, loadFarmState, updatePond } from "../../storage/farm-store";
import "./index.scss";

function getRoutePondId(): string {
  return Taro.getCurrentInstance().router?.params?.pondId ?? "";
}

export default function PondFormPage() {
  const [pondId, setPondId] = useState("");
  const [name, setName] = useState("");
  const [species, setSpecies] = useState("");
  const [location, setLocation] = useState("");
  const [areaMu, setAreaMu] = useState("");
  const [day, setDay] = useState("");
  const [saving, setSaving] = useState(false);
  const isEditing = Boolean(pondId);

  useEffect(() => {
    async function init() {
      const routePondId = getRoutePondId();
      if (!routePondId) return;

      const state = await loadFarmState();
      const pond = state.ponds.find((item) => item.id === routePondId);
      if (!pond) {
        Taro.showToast({ title: "未找到塘口", icon: "none" });
        return;
      }

      setPondId(pond.id);
      setName(pond.name);
      setSpecies(pond.species);
      setLocation(pond.location);
      setAreaMu(String(pond.areaMu));
      setDay(String(pond.day));
      Taro.setNavigationBarTitle({ title: "编辑塘口" });
    }
    init();
  }, []);

  async function handleSave() {
    if (saving) return;

    const input = {
      name,
      species,
      location,
      areaMu: Number(areaMu),
      day: Number(day)
    };
    const result = validatePondInput(input);
    if (!result.valid) {
      Taro.showToast({ title: result.message, icon: "none" });
      return;
    }

    setSaving(true);
    try {
      if (isEditing) {
        await updatePond(pondId, input);
      } else {
        await addPond(input);
      }
      await Taro.showToast({ title: "保存成功", icon: "success" });
      Taro.navigateBack();
    } finally {
      setSaving(false);
    }
  }

  return (
    <View className="form-page">
      <View className="form-head">
        <Text className="title">{isEditing ? "编辑塘口" : "新增塘口"}</Text>
        <Text className="subtitle">把养殖塘口资料保存在本机，后续记录会自动汇总到驾驶舱。</Text>
      </View>

      <View className="field">
        <Text className="label">塘口名称</Text>
        <Input className="input" value={name} placeholder="例如 3号高位池" onInput={(event) => setName(event.detail.value)} />
      </View>

      <View className="field">
        <Text className="label">养殖品种</Text>
        <Input className="input" value={species} placeholder="例如 南美白对虾" onInput={(event) => setSpecies(event.detail.value)} />
      </View>

      <View className="field">
        <Text className="label">所在位置</Text>
        <Input className="input" value={location} placeholder="例如 广东湛江 麻章区" onInput={(event) => setLocation(event.detail.value)} />
      </View>

      <View className="field-row">
        <View className="field compact">
          <Text className="label">面积（亩）</Text>
          <Input className="input" type="digit" value={areaMu} placeholder="8.5" onInput={(event) => setAreaMu(event.detail.value)} />
        </View>
        <View className="field compact">
          <Text className="label">入塘天数</Text>
          <Input className="input" type="number" value={day} placeholder="42" onInput={(event) => setDay(event.detail.value)} />
        </View>
      </View>

      <Text className="save-button" onClick={handleSave}>
        {saving ? "保存中..." : isEditing ? "保存修改" : "保存塘口"}
      </Text>
    </View>
  );
}
