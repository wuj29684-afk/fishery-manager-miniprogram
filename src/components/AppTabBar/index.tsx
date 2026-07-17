import Taro from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import { BarChartOutlined, HomeOutlined, RecordsOutlined } from "@taroify/icons";
import "./index.scss";

type TabKey = "home" | "records" | "data";

const tabs = [
  { key: "home" as const, label: "首页", url: "/pages/index/index", Icon: HomeOutlined },
  { key: "records" as const, label: "记录", url: "/pages/records/index", Icon: RecordsOutlined },
  { key: "data" as const, label: "数据", url: "/pages/data-backup/index", Icon: BarChartOutlined }
];

export default function AppTabBar({ active }: { active: TabKey }) {
  const open = (key: TabKey, url: string) => {
    if (key !== active) Taro.redirectTo({ url });
  };

  return (
    <View className="app-tabbar">
      {tabs.map(({ key, label, url, Icon }) => (
        <View className={`app-tab ${active === key ? "active" : ""}`} key={key} onClick={() => open(key, url)}>
          <Icon className="app-tab-icon" size="24" />
          <Text className="app-tab-label">{label}</Text>
        </View>
      ))}
    </View>
  );
}
