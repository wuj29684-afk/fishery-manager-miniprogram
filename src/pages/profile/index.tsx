import Taro from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import {
  AppsOutlined,
  BarChartOutlined,
  Bell,
  BillOutlined,
  CalendarOutlined,
  DescriptionOutlined,
  FriendsOutlined,
  SettingOutlined,
  ShieldOutlined,
  ShopOutlined,
  TodoListOutlined,
  UserOutlined
} from "@taroify/icons";
import AppTabBar from "../../components/AppTabBar";
import { loadV4State } from "../../v4/store";
import "./index.scss";

const groups = [
  {
    title: "经营工具",
    tone: "green",
    items: [
      { label: "库存管理", Icon: ShopOutlined, url: "/pages/data-backup/index?section=inventory" },
      { label: "任务管理", Icon: TodoListOutlined, url: "/pages/data-backup/index?section=tasks" },
      { label: "报表中心", Icon: BarChartOutlined, url: "/pages/reports/index" },
      { label: "模板管理", Icon: DescriptionOutlined, url: "/pages/data-backup/index?section=templates" }
    ]
  },
  {
    title: "协作管理",
    tone: "blue",
    items: [
      { label: "成员管理", Icon: FriendsOutlined, url: "/pages/data-backup/index?section=members" },
      { label: "权限管理", Icon: ShieldOutlined, url: "/pages/data-backup/index?section=members" },
      { label: "操作日志", Icon: CalendarOutlined, url: "/pages/data-backup/index?section=logs" },
      { label: "邀请成员", Icon: UserOutlined, url: "/pages/data-backup/index?section=members" }
    ]
  },
  {
    title: "数据服务",
    tone: "orange",
    items: [
      { label: "数据同步", Icon: AppsOutlined, url: "/pages/data-backup/index" },
      { label: "本地备份", Icon: ShieldOutlined, url: "/pages/data-backup/index?section=backup" },
      { label: "恢复数据", Icon: Bell, url: "/pages/data-backup/index?section=backup" },
      { label: "导出数据", Icon: BillOutlined, url: "/pages/data-backup/index?section=backup" }
    ]
  },
  {
    title: "通用设置",
    tone: "purple",
    items: [
      { label: "养殖设置", Icon: SettingOutlined, url: "/pages/data-backup/index?section=settings" },
      { label: "单位设置", Icon: BillOutlined, url: "/pages/data-backup/index?section=settings" },
      { label: "天气服务", Icon: CalendarOutlined, url: "/pages/data-backup/index?section=weather" },
      { label: "关于我们", Icon: DescriptionOutlined, url: "/pages/about-data/index" }
    ]
  }
];

export default function ProfilePage() {
  const state = loadV4State();
  return <View className="profile-page safe-tab-page">
    <View className="profile-head">
      <Text className="profile-title">我的</Text>
      <Text className="profile-status">{state.auth.status === "bound" ? `已登录 · ${state.auth.displayName}` : "本机使用中 · 未登录"}</Text>
    </View>
    {groups.map((group) => <View className={`tool-group tool-${group.tone}`} key={group.title}>
      <Text className="tool-title">{group.title}</Text>
      <View className="tool-grid">
        {group.items.map(({ label, Icon, url }) => <View className="tool-item" key={label} onClick={() => Taro.navigateTo({ url })}>
          <Icon className="tool-icon" size="28" />
          <Text>{label}</Text>
        </View>)}
      </View>
    </View>)}
    <AppTabBar active="mine" />
  </View>;
}
