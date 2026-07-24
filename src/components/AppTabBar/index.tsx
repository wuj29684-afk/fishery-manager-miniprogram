import Taro from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import { HomeOutlined, Plus, RecordsOutlined, ShopOutlined, UserOutlined } from "@taroify/icons";
import "./index.scss";

type TabKey = "home" | "units" | "quick" | "records" | "mine";

const tabs = [
  { key: "home" as const, label: "首页", url: "/pages/index/index", Icon: HomeOutlined },
  { key: "units" as const, label: "养殖", url: "/pages/units/index", Icon: ShopOutlined },
  { key: "quick" as const, label: "快记", url: "/pages/record-form/index", Icon: Plus },
  { key: "records" as const, label: "记录", url: "/pages/records/index", Icon: RecordsOutlined },
  { key: "mine" as const, label: "我的", url: "/pages/profile/index", Icon: UserOutlined },
];

export default function AppTabBar({ active }: { active?: TabKey }) {
  const open = (key: TabKey, url: string) => {
    if (key === "quick") {
      Taro.navigateTo({ url });
      return;
    }
    if (key !== active) Taro.redirectTo({ url });
  };

  return (
    <View className="app-tabbar">
      {tabs.map(({ key, label, url, Icon }) => (
        <View className={`app-tab ${key === "quick" ? "app-tab-quick" : ""} ${active === key ? "active" : ""}`} key={key} onClick={() => open(key, url)}>
          <View className="app-tab-icon-wrap"><Icon className="app-tab-icon" size={key === "quick" ? "38" : "34"} /></View>
          <Text className="app-tab-label">{label}</Text>
        </View>
      ))}
    </View>
  );
}
