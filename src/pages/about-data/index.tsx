import { Text, View } from "@tarojs/components";
import type { ReactNode } from "react";
import "./index.scss";

const summaryCards = [
  {
    label: "数据方式",
    value: "仅本地存储",
    detail: "当前数据仅保存在本机微信小程序本地存储。"
  },
  {
    label: "版本状态",
    value: "0.1.2 体验版",
    detail: "已完成备案和真机验证，仍未正式发布。"
  },
  {
    label: "能力范围",
    value: "塘口 + 记录 + 备份",
    detail: "支持本地经营记录、搜索筛选、JSON 备份和恢复。"
  },
  {
    label: "客服状态",
    value: "暂无在线客服",
    detail: "当前体验版暂无在线客服，后续按正式运营需要补齐。"
  }
];

const featureItems = [
  "塘口创建、编辑、停用和详情查看。",
  "投料、水质、用药、收获四类经营记录。",
  "记录编辑、删除和二次确认。",
  "首页塘口搜索、状态筛选和经营指标汇总。",
  "JSON 备份复制、JSON 导入恢复和 CSV 记录导出。"
];

const boundaryItems = [
  "当前版本不上传服务器，不接入真实网络请求。",
  "当前不接入微信登录、支付、定位、文件上传或图片上传。",
  "AppSecret 只能放在服务端，当前小程序代码不包含 AppSecret。",
  "本机卸载微信、清理小程序数据或更换设备后，本地数据可能无法自动恢复，请先使用数据备份。"
];

const reviewPath = ["首页", "新增塘口", "快速记录", "塘口详情", "数据备份", "关于与数据"];

const roadmapItems = [
  "发布前继续复核隐私政策、用户协议、服务类目和审核截图素材。",
  "登录、云端同步、异常提醒和数据模型升级会在正式确认后分阶段推进。",
  "正式接入服务端时，AppSecret 仍只放在服务端，不进入小程序代码、配置或日志。"
];

function InfoSection(props: { title: string; children: ReactNode }) {
  return (
    <View className="info-section">
      <Text className="section-title">{props.title}</Text>
      {props.children}
    </View>
  );
}

export default function AboutDataPage() {
  return (
    <View className="about-page">
      <View className="about-head">
        <Text className="eyebrow">产品说明</Text>
        <Text className="title">关于与数据说明</Text>
        <Text className="subtitle">了解当前版本能力、数据存储方式和隐私边界。</Text>
      </View>

      <View className="summary-grid">
        {summaryCards.map((card) => (
          <View className="summary-card" key={card.label}>
            <Text className="summary-label">{card.label}</Text>
            <Text className="summary-value">{card.value}</Text>
            <Text className="summary-detail">{card.detail}</Text>
          </View>
        ))}
      </View>

      <InfoSection title="产品定位">
        <Text className="section-copy">
          渔业养殖智能管家当前定位为一线塘口经营值班台，帮助现场快速记录、查看塘口状态和复盘经营数据。
        </Text>
      </InfoSection>

      <InfoSection title="当前功能">
        {featureItems.map((item) => (
          <Text className="list-row" key={item}>
            {item}
          </Text>
        ))}
      </InfoSection>

      <InfoSection title="数据与隐私边界">
        <View className="boundary-box">
          <Text className="boundary-title">本地数据优先</Text>
          <Text className="boundary-copy">当前数据仅保存在本机微信小程序本地存储。</Text>
        </View>
        {boundaryItems.map((item) => (
          <Text className="list-row" key={item}>
            {item}
          </Text>
        ))}
      </InfoSection>

      <InfoSection title="体验版说明">
        <Text className="section-copy">
          当前版本用于体验和发布前复核，已完成备案、上传体验版并通过真机验证，仍未正式发布。
        </Text>
      </InfoSection>

      <InfoSection title="审核体验路径">
        <View className="path-row">
          {reviewPath.map((item, index) => (
            <Text className="path-item" key={item}>
              {index === 0 ? item : `→ ${item}`}
            </Text>
          ))}
        </View>
      </InfoSection>

      <InfoSection title="后续规划">
        {roadmapItems.map((item) => (
          <Text className="list-row" key={item}>
            {item}
          </Text>
        ))}
      </InfoSection>
    </View>
  );
}
