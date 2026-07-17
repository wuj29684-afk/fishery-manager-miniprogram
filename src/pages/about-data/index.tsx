import { Image, Text, View } from "@tarojs/components";
import { BarChartOutlined, BulbOutlined, RecordsOutlined, ShieldOutlined } from "@taroify/icons";
import type { ReactNode } from "react";
import brandEmblem from "../../assets/brand-emblem.png";
import pondLandscape from "../../assets/pond-landscape.jpg";
import "./index.scss";

const summaryCards = [
  {
    label: "数据方式",
    value: "本机优先 + 账号同步",
    detail: "默认保存在本机；主动操作后才按当前微信账号隔离同步。",
    Icon: ShieldOutlined
  },
  {
    label: "版本状态",
    value: "0.2.8 体验版",
    detail: "线上正式版为 0.2.6；当前 0.2.8 已上传体验版，尚未提交审核。",
    Icon: BulbOutlined
  },
  {
    label: "能力范围",
    value: "塘口 + 记录 + 备份",
    detail: "支持塘口、七类记录、预警、经营汇总、备份和恢复。",
    Icon: RecordsOutlined
  },
  {
    label: "数据安全",
    value: "本机代管 + 云端隔离",
    detail: "不出售经营数据，不接入广告画像，账号数据按微信身份隔离。",
    Icon: BarChartOutlined
  }
];

const featureItems = [
  "塘口创建、编辑、停用和详情查看。",
  "投料、水质、用药、收获、抽样、死亡、经营支出七类记录。",
  "记录编辑、删除和二次确认。",
  "首页塘口搜索、状态筛选和经营指标汇总。",
  "JSON 备份复制、JSON 导入恢复和 CSV 记录导出。"
];

const boundaryItems = [
  "默认经营数据先保存在本机微信小程序本地存储。",
  "用户主动点击“绑定本机数据到账号”时，会通过微信云开发把塘口和记录同步到当前微信账号。",
  "用户主动点击“使用账号数据”时，会拉取当前微信账号下的云端塘口和记录；覆盖本机前会二次确认。",
  "账号同步按微信云开发 OPENID 隔离数据，客户端传入的 ownerUserId 会被忽略。",
  "当前不接入支付、定位、文件上传或图片上传。",
  "AppSecret 只能放在服务端，当前小程序代码不包含 AppSecret。",
  "本机卸载微信、清理小程序数据或更换设备后，本地数据可能无法自动恢复；如需恢复，请先使用 JSON 备份或账号同步。"
];

const reviewPath = ["账号进入", "首页", "新增塘口", "快速记录", "塘口详情", "数据备份", "关于与数据"];

const roadmapItems = [
  "继续完善隐私政策、用户协议、服务类目和审核截图素材，使说明与云同步能力保持一致。",
  "发布前继续复核隐私政策、用户协议、服务类目和审核截图素材。",
  "异常提醒、数据模型升级和多设备同步体验会在正式确认后分阶段推进。",
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
        <Image className="about-emblem" src={brandEmblem} mode="aspectFit" />
        <View><Text className="title">渔儿小助手</Text><Text className="subtitle">帮助水产养殖户高效记录、科学管理、稳产增收</Text></View>
      </View>

      <View className="summary-grid">
        {summaryCards.map((card) => (
          <View className="summary-card" key={card.label}>
            <card.Icon className="summary-icon" size="24" />
            <Text className="summary-label">{card.label}</Text>
            <Text className="summary-value">{card.value}</Text>
            <Text className="summary-detail">{card.detail}</Text>
          </View>
        ))}
      </View>

      <InfoSection title="产品定位">
        <Text className="section-copy">
          渔儿小助手当前定位为一线塘口经营值班台，帮助现场快速记录、查看塘口状态和复盘经营数据。
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
          <Text className="boundary-title">本机优先，主动同步</Text>
          <Text className="boundary-copy">未点击账号同步时，数据只写入本机；点击同步后，塘口和记录按当前微信账号隔离保存到微信云开发。</Text>
        </View>
        {boundaryItems.map((item) => (
          <Text className="list-row" key={item}>
            {item}
          </Text>
        ))}
      </InfoSection>

      <InfoSection title="线上版说明">
        <Text className="section-copy">
          当前线上正式版为 0.2.6；0.2.8 已上传开发/体验版本，尚未提交审核或正式发布。
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
      <Image className="about-landscape" src={pondLandscape} mode="aspectFill" />
    </View>
  );
}
