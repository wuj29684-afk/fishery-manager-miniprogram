import { useState } from "react";
import Taro, { useDidShow } from "@tarojs/taro";
import { Input, Switch, Text, Textarea, View } from "@tarojs/components";
import { ArrowLeft, ArrowRight, ShieldOutlined, Wechat } from "@taroify/icons";
import AppTabBar from "../../components/AppTabBar";
import { createId } from "../../domain/id";
import { createCompleteEncryptedBackup, parseEncryptedBackup } from "../../v4/backup";
import { purchaseInventory } from "../../v4/inventory";
import { createRecordsCsv } from "../../v4/report";
import { bindCurrentWechatAccount, ensureCloudBase, loadV4State, requestTaskSubscription, resetV4State, saveV4State, syncV4State } from "../../v4/store";
import { loadCityWeather } from "../../v4/weather";
import { createTemplate, resolveV4Conflict } from "../../v4/state";
import type { V4State } from "../../v4/types";
import "./index.scss";

declare const wx: {
  cloud?: {
    callFunction<T = unknown>(options: { name: string; data: Record<string, unknown> }): Promise<{ result?: T }>;
  };
};

export default function DataBackupPage() {
  const [state, setState] = useState<V4State>(() => loadV4State());
  const [stockName, setStockName] = useState("");
  const [stockKg, setStockKg] = useState("");
  const [stockCost, setStockCost] = useState("");
  const [stockKind, setStockKind] = useState<"feed" | "drug">("feed");
  const [taskTitle, setTaskTitle] = useState("");
  const [templateName, setTemplateName] = useState("");
  const [inviteCode, setInviteCode] = useState("");
  const [password, setPassword] = useState("");
  const [restoreText, setRestoreText] = useState("");
  const [busy, setBusy] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(Taro.getCurrentInstance().router?.params?.section));
  useDidShow(() => setState(loadV4State()));
  const farm = state.farms.find((item) => item.id === state.settings.selectedFarmId) || state.farms[0];

  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try { await action(); } catch (error) {
      await Taro.showToast({ title: error instanceof Error ? error.message : "操作失败", icon: "none" });
    } finally { setBusy(false); }
  }

  async function addStock() {
    if (!farm || !stockName.trim() || Number(stockKg) <= 0 || Number(stockCost) < 0) throw new Error("请完整填写采购信息");
    const next = purchaseInventory(state, {
      farmId: farm.id, kind: stockKind, name: stockName.trim(),
      quantityKg: Number(stockKg), totalCostYuan: Number(stockCost)
    }, state.auth.userId);
    setState(saveV4State(next)); setStockName(""); setStockKg(""); setStockCost("");
    await Taro.showToast({ title: "采购已入库", icon: "success" });
  }

  async function addTask() {
    if (!farm || !taskTitle.trim()) throw new Error("请填写任务名称");
    const now = new Date().toISOString();
    const next = {
      ...state,
      tasks: [...state.tasks, {
        id: createId("task"), farmId: farm.id, type: "patrol" as const, title: taskTitle.trim(),
        schedule: "daily", reminderTime: "08:00", enabled: true, createdAt: now, updatedAt: now
      }],
      syncMeta: { ...state.syncMeta, status: "pending" as const, message: "有数据待同步" }
    };
    setState(saveV4State(next)); setTaskTitle("");
    await Taro.showToast({ title: "任务已创建", icon: "success" });
  }

  async function addTemplate() {
    if (!farm || !templateName.trim()) throw new Error("请填写模板名称");
    const now = new Date().toISOString();
    const next = createTemplate(state, {
      id: createId("template"),
      farmId: farm.id,
      name: templateName.trim(),
      recordType: "custom",
      fields: [{ key: "value", label: "记录内容", type: "text" }],
      createdAt: now,
      updatedAt: now
    });
    setState(saveV4State(next)); setTemplateName("");
    await Taro.showToast({ title: "自定义模板已创建", icon: "success" });
  }

  async function copyBackup() {
    const value = createCompleteEncryptedBackup(state, password);
    await Taro.setClipboardData({ data: value });
    await Taro.showToast({ title: "加密备份已复制", icon: "success" });
  }

  async function restoreBackup() {
    const restored = parseEncryptedBackup(restoreText.trim(), password);
    const confirm = await Taro.showModal({ title: "覆盖本机数据", content: `备份包含 ${restored.farms.length} 个养殖场、${restored.records.length} 条记录。`, confirmText: "恢复", confirmColor: "#c43d2b" });
    if (!confirm.confirm) return;
    setState(saveV4State(restored)); setRestoreText("");
    await Taro.showToast({ title: "恢复成功", icon: "success" });
  }

  async function createInvite() {
    if (!farm || state.auth.status !== "bound") throw new Error("请先绑定微信账号并创建养殖场");
    if (!wx.cloud) throw new Error("云开发尚未配置");
    ensureCloudBase();
    const response = await wx.cloud.callFunction<{ code?: string }>({ name: "syncAccountData", data: { action: "inviteCreate", farmId: farm.id } });
    if (!response.result?.code) throw new Error("邀请码生成失败");
    await Taro.setClipboardData({ data: response.result.code });
    await Taro.showToast({ title: "邀请码已复制", icon: "success" });
  }

  async function acceptInvite() {
    if (!inviteCode.trim()) throw new Error("请输入邀请码");
    if (state.auth.status !== "bound") throw new Error("请先绑定微信账号");
    if (!wx.cloud) throw new Error("云开发尚未配置");
    ensureCloudBase();
    await wx.cloud.callFunction({ name: "syncAccountData", data: { action: "inviteAccept", code: inviteCode.trim().toUpperCase() } });
    setInviteCode("");
    await Taro.showModal({ title: "申请已提交", content: "需要养殖场负责人批准后才能读取和记录数据。", showCancel: false });
  }

  async function approveMember(userId: string) {
    if (!wx.cloud || !farm) throw new Error("云开发尚未配置");
    ensureCloudBase();
    const unitIds = state.units.filter((unit) => unit.farmId === farm.id).map((unit) => unit.id);
    await wx.cloud.callFunction({
      name: "syncAccountData",
      data: { action: "memberApprove", userId, unitIds, canViewFinance: false }
    });
    const next = {
      ...state,
      members: state.members.map((member) => member.userId === userId ? { ...member, unitIds, status: "active" as const } : member)
    };
    setState(saveV4State(next));
    await Taro.showToast({ title: "成员已批准", icon: "success" });
  }

  async function loadMemberData() {
    if (!wx.cloud || state.auth.status !== "bound") throw new Error("请先绑定微信账号");
    ensureCloudBase();
    const response = await wx.cloud.callFunction<{ state?: V4State; revision?: number }>({ name: "syncAccountData", data: { action: "v4MemberPull" } });
    if (!response.result?.state) throw new Error("尚未获得负责人批准");
    const next = {
      ...response.result.state,
      auth: state.auth,
      syncMeta: { ...response.result.state.syncMeta, baseRevision: response.result.revision || 0, status: "synced" as const, message: "成员数据已载入" }
    };
    setState(saveV4State(next));
  }

  async function deleteAccount() {
    const otherMembers = state.members.filter((member) => member.role !== "owner" && member.status === "active");
    if (otherMembers.length) throw new Error("请先移交或停用其他成员");
    const confirm = await Taro.showModal({ title: "注销账号", content: "将删除云端账号数据并清除本机 0.4 数据。此操作无法撤销。", confirmText: "确认注销", confirmColor: "#c43d2b" });
    if (!confirm.confirm) return;
    if (state.auth.status === "bound") {
      if (!wx.cloud) throw new Error("云开发尚未配置，无法确认云端删除");
      ensureCloudBase();
      await wx.cloud.callFunction({ name: "syncAccountData", data: { action: "v4DeleteAccount" } });
    }
    setState(resetV4State());
    await Taro.showToast({ title: "账号数据已注销", icon: "success" });
  }

  async function changeCity(field: "province" | "city" | "district", value: string) {
    if (!farm) return;
    const next = {
      ...state,
      farms: state.farms.map((item) => item.id === farm.id ? { ...item, [field]: value, updatedAt: new Date().toISOString() } : item)
    };
    setState(saveV4State(next));
  }

  return <View className="backup-page safe-tab-page">
    <View className="backup-head"><ArrowLeft size="22" onClick={() => Taro.navigateBack()} /><View><Text className="title">数据同步与协作</Text><Text className="subtitle">本机数据始终可用，登录后可备份与多设备恢复</Text></View><View /></View>

    <View className="local-status">
      <View className="status-icon"><ShieldOutlined size="32" /></View>
      <View><Text className="status-title">本地数据状态</Text><Text className="status-copy">数据保存在本机，未登录也不影响使用</Text><Text className="status-time">最近修改：{state.records[0]?.date || "暂无记录"}</Text></View>
      <Text className="safe-badge">安全</Text>
    </View>

    <Text className="backup-section-title">微信账号（可选）</Text>
    <View className="account-row" onClick={state.auth.status === "guest" ? () => run(async () => setState(await bindCurrentWechatAccount())) : undefined}>
      <View className="wechat-icon"><Wechat size="28" /></View>
      <View><Text className="account-title">{state.auth.status === "bound" ? state.auth.displayName || "微信账号已登录" : "微信登录（可选）"}</Text><Text className="account-copy">{state.auth.status === "bound" ? "登录后可备份、跨设备恢复与协作" : "点击登录并启用账号数据服务"}</Text></View>
      <ArrowRight size="20" />
    </View>

    <Text className="backup-section-title">数据备份</Text>
    <View className="backup-list">
      <View className="backup-row" onClick={() => run(async () => state.auth.status === "bound" ? setState(await syncV4State()) : Promise.reject(new Error("请先登录微信账号")))}>
        <View><Text className="backup-row-title">云端备份（可选）</Text><Text className="backup-row-copy">{state.auth.status === "bound" ? state.syncMeta.message : "未启用"}</Text></View><ArrowRight size="20" />
      </View>
      <View className="backup-row" onClick={() => setAdvancedOpen(true)}><View><Text className="backup-row-title">本地加密备份</Text><Text className="backup-row-copy">复制加密备份文本，适合自行保管</Text></View><ArrowRight size="20" /></View>
    </View>

    <Text className="backup-section-title">协作与权限</Text>
    <View className="backup-list">
      <View className="backup-row" onClick={() => setAdvancedOpen(true)}><View><Text className="backup-row-title">成员与权限管理</Text><Text className="backup-row-copy">邀请成员、设置查看与记录权限</Text></View><ArrowRight size="20" /></View>
      <View className="backup-row"><View><Text className="backup-row-title">操作日志</Text><Text className="backup-row-copy">查看重要数据操作记录</Text></View><ArrowRight size="20" /></View>
    </View>

    <View className="conflict-note"><Text>冲突处理</Text><Text>发现重复操作时，可选择保留本机或使用云端数据。</Text></View>

    <Text className="advanced-entry" onClick={() => setAdvancedOpen(!advancedOpen)}>{advancedOpen ? "收起高级工具" : "展开高级工具"}</Text>
    {advancedOpen && <View className="advanced-tools">
    <Section title="账号与同步">
      {state.auth.status === "guest" && <Text className="primary-button" onClick={() => run(async () => setState(await bindCurrentWechatAccount()))}>登录当前微信账号</Text>}
      {state.auth.status === "bound" && <Text className="secondary-button" onClick={() => run(async () => setState(await syncV4State()))}>{busy ? "处理中..." : `立即同步 · ${state.syncMeta.message}`}</Text>}
      {state.syncMeta.conflicts.map((conflict) => <View key={conflict.id}>
        <Text className="setting-note">冲突：{conflict.entityType} · {conflict.entityId}</Text>
        <Text className="secondary-button" onClick={() => setState(saveV4State(resolveV4Conflict(state, conflict.id, "local")))}>保留本机</Text>
        <Text className="secondary-button" onClick={() => setState(saveV4State(resolveV4Conflict(state, conflict.id, "remote")))}>使用云端</Text>
      </View>)}
    </Section>

    <Section title="饲料与药品库存">
      {state.inventory.map((item) => <Text className="setting-note" key={item.id}>{item.name}：{item.quantityKg} kg · 均价 ¥{item.averageUnitCostYuan}/kg</Text>)}
      <View className="weight-switch"><Text className={stockKind === "feed" ? "active" : ""} onClick={() => setStockKind("feed")}>饲料</Text><Text className={stockKind === "drug" ? "active" : ""} onClick={() => setStockKind("drug")}>药品</Text></View>
      <Input value={stockName} placeholder="饲料或药品名称" onInput={(event) => setStockName(event.detail.value)} />
      <Input type="digit" value={stockKg} placeholder="采购重量 kg" onInput={(event) => setStockKg(event.detail.value)} />
      <Input type="digit" value={stockCost} placeholder="采购总金额 元" onInput={(event) => setStockCost(event.detail.value)} />
      <Text className="secondary-button" onClick={() => run(addStock)}>采购入库</Text>
    </Section>

    <Section title="成员与权限">
      {state.members.map((member) => <View key={member.id}><Text className="setting-note">{member.displayName} · {member.role === "owner" ? "负责人" : "记录员"} · {member.status === "active" ? "启用" : "待批准/停用"}</Text>{member.role === "recorder" && member.status !== "active" && <Text className="secondary-button" onClick={() => run(() => approveMember(member.userId))}>批准并授权本场全部单元</Text>}</View>)}
      <Text className="secondary-button" onClick={() => run(createInvite)}>生成记录员邀请码</Text>
      <Input value={inviteCode} placeholder="输入 8 位邀请码加入养殖场" onInput={(event) => setInviteCode(event.detail.value)} />
      <Text className="secondary-button" onClick={() => run(acceptInvite)}>申请加入</Text>
      <Text className="secondary-button" onClick={() => run(loadMemberData)}>载入已批准的成员数据</Text>
    </Section>

    <Section title="任务与提醒">
      {state.tasks.map((task) => <Text className="setting-note" key={task.id}>{task.title} · {task.schedule} · {task.enabled ? "已启用" : "已停用"}</Text>)}
      <Input value={taskTitle} placeholder="例如：每日巡塘" onInput={(event) => setTaskTitle(event.detail.value)} />
      <Text className="secondary-button" onClick={() => run(addTask)}>创建每日任务</Text>
      <Text className="secondary-button" onClick={() => run(async () => { const accepted = await requestTaskSubscription(); await Taro.showToast({ title: accepted ? "已允许提醒" : "未允许提醒", icon: "none" }); })}>申请订阅消息提醒</Text>
    </Section>

    <Section title="自定义记录模板">
      {state.templates.map((template) => <Text className="setting-note" key={template.id}>{template.name} · {template.fields.length} 个字段</Text>)}
      <Input value={templateName} placeholder="模板名称（最多 5 个字段）" onInput={(event) => setTemplateName(event.detail.value)} />
      <Text className="secondary-button" onClick={() => run(addTemplate)}>创建单字段模板</Text>
    </Section>

    <Section title="城市级天气">
      <Input value={farm?.province || ""} placeholder="省" onBlur={(event) => changeCity("province", event.detail.value)} />
      <Input value={farm?.city || ""} placeholder="市" onBlur={(event) => changeCity("city", event.detail.value)} />
      <Input value={farm?.district || ""} placeholder="区县" onBlur={(event) => changeCity("district", event.detail.value)} />
      <Text className="setting-note">不申请精确定位；配置天气服务后按城市/区县查询。</Text>
      <Text className="secondary-button" onClick={() => run(async () => {
        if (!farm) throw new Error("请先创建养殖场");
        const weather = await loadCityWeather(farm.province, farm.city, farm.district);
        await Taro.showModal({ title: weather.location, content: `${weather.text} ${weather.temperatureC}℃${weather.warning ? `\n${weather.warning}` : ""}`, showCancel: false });
      })}>查询城市天气</Text>
    </Section>

    <Section title="完整加密备份">
      <Input password value={password} placeholder="备份密码（至少 4 位）" onInput={(event) => setPassword(event.detail.value)} />
      <Text className="secondary-button" onClick={() => run(copyBackup)}>复制完整加密备份</Text>
      <Text className="secondary-button" onClick={() => run(async () => {
        await Taro.setClipboardData({ data: createRecordsCsv(state) });
        await Taro.showToast({ title: "记录 CSV 已复制", icon: "success" });
      })}>复制记录 CSV</Text>
      <Textarea value={restoreText} placeholder="粘贴 FISHERY-MANAGER-V4 加密备份" onInput={(event) => setRestoreText(event.detail.value)} />
      <Text className="secondary-button" onClick={() => run(restoreBackup)}>验证并恢复</Text>
    </Section>
    <Text className="primary-button" onClick={() => Taro.navigateTo({ url: "/pages/reports/index" })}>生成经营报告长图</Text>

    <Section title="隐私与诊断">
      <View className="switch-row"><Text>匿名诊断</Text><Switch checked={state.settings.telemetryEnabled} onChange={(event) => setState(saveV4State({ ...state, settings: { ...state.settings, telemetryEnabled: event.detail.value } }))} /></View>
      <Text className="setting-note">仅记录功能名、成功状态、耗时与错误类别，不记录经营数值、备注、图片或位置。</Text>
      <Text className="delete-button" onClick={() => run(deleteAccount)}>注销账号</Text>
    </Section>
    <Text className="secondary-button" onClick={() => Taro.navigateTo({ url: "/pages/about-data/index" })}>关于数据与隐私</Text>
    </View>}
    <AppTabBar active="mine" />
  </View>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <View className="settings-section"><Text className="section-title">{title}</Text>{children}</View>;
}
