import { useEffect, useState } from "react";
import Taro from "@tarojs/taro";
import { Canvas, Text, View } from "@tarojs/components";
import { createReportLines, type ReportKind } from "../../v4/report";
import { loadV4State } from "../../v4/store";
import "./index.scss";

const kinds: Array<{ value: ReportKind; label: string }> = [
  { value: "daily", label: "今日值班" }, { value: "weekly", label: "本周简报" }, { value: "batch", label: "批次结算" }
];

export default function ReportsPage() {
  const [kind, setKind] = useState<ReportKind>("daily");
  const [ready, setReady] = useState(false);
  const state = loadV4State();

  useEffect(() => {
    const context = Taro.createCanvasContext("reportCanvas");
    const lines = createReportLines(state, kind);
    context.setFillStyle("#ffffff"); context.fillRect(0, 0, 690, 1500);
    context.setFillStyle("#12372a"); context.setFontSize(34); context.fillText(lines[0], 40, 70);
    context.setFontSize(22);
    lines.slice(1).forEach((line, index) => context.fillText(line.slice(0, 36), 40, 125 + index * 52));
    context.draw(false, () => setReady(true));
  }, [kind]);

  async function saveImage() {
    if (!ready) return;
    const result = await Taro.canvasToTempFilePath({ canvasId: "reportCanvas", fileType: "png", quality: 1 });
    await Taro.saveImageToPhotosAlbum({ filePath: result.tempFilePath });
    await Taro.showToast({ title: "报告长图已保存", icon: "success" });
  }

  return <View className="report-page">
    <Text className="title">经营报告长图</Text>
    <View className="report-actions">{kinds.map((item) => <Text key={item.value} className={kind === item.value ? "active" : ""} onClick={() => { setReady(false); setKind(item.value); }}>{item.label}</Text>)}</View>
    <Canvas canvasId="reportCanvas" className="report-canvas" />
    <Text className="report-button" onClick={saveImage}>{ready ? "保存到相册并转发" : "正在生成..."}</Text>
  </View>;
}
