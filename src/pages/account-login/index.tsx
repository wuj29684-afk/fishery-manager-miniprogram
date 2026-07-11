import { useEffect } from "react";
import Taro from "@tarojs/taro";
import { Text, View } from "@tarojs/components";
import "./index.scss";

export default function AccountLoginCompatibilityPage() {
  useEffect(() => { Taro.reLaunch({ url: "/pages/index/index" }); }, []);
  return <View className="login-page"><Text className="title">正在进入渔儿小助手...</Text><Text className="hint">本机经营数据可离线使用，账号同步将在后台检查。</Text></View>;
}
