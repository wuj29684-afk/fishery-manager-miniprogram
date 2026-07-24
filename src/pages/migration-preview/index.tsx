import { useEffect, useState } from "react";
import { Button, Text, View } from "@tarojs/components";
import type { FarmStateV3Preview } from "../../domain/farm-state-v3-preview";
import { inspectCurrentFarmStateV3 } from "../../storage/farm-store-v3-preview";
import "./index.scss";

const metrics: Array<{
  key: "farmCount" | "unitCount" | "batchCount" | "recordCount";
  label: string;
  suffix: string;
}> = [
  { key: "farmCount", label: "养殖场", suffix: "个" },
  { key: "unitCount", label: "养殖单元", suffix: "个" },
  { key: "batchCount", label: "养殖批次", suffix: "个" },
  { key: "recordCount", label: "记录", suffix: "条" }
];

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : "迁移预览生成失败";
}

export default function MigrationPreviewPage() {
  const [preview, setPreview] = useState<FarmStateV3Preview | null>(null);
  const [error, setError] = useState("");

  function inspect() {
    setError("");
    try {
      setPreview(inspectCurrentFarmStateV3());
    } catch (nextError) {
      setPreview(null);
      setError(errorMessage(nextError));
    }
  }

  useEffect(() => {
    inspect();
  }, []);

  return (
    <View className="migration-page">
      <View className="migration-head">
        <Text className="eyebrow">0.4.0 内部诊断</Text>
        <Text className="title">只读迁移检查</Text>
        <Text className="subtitle">
          读取当前 v2 原数据并生成隔离预览，不会切换正式存储、修改经营数据或发起云同步。
        </Text>
      </View>

      <View className="migration-track">
        <View className="track-step active">
          <Text className="track-index">01</Text>
          <Text className="track-label">v2 原数据</Text>
          <Text className="track-detail">仅读取</Text>
        </View>
        <View className="track-line" />
        <View className="track-step active">
          <Text className="track-index">02</Text>
          <Text className="track-label">隔离预览</Text>
          <Text className="track-detail">专用存储键</Text>
        </View>
        <View className="track-line" />
        <View className="track-step">
          <Text className="track-index">03</Text>
          <Text className="track-label">v3 目标结构</Text>
          <Text className="track-detail">尚未启用</Text>
        </View>
      </View>

      {error ? (
        <View className="state-band error-band">
          <Text className="state-title">检查未通过</Text>
          <Text className="state-copy">{error}</Text>
        </View>
      ) : preview ? (
        <>
          <View className="summary-head">
            <Text className="section-title">迁移摘要</Text>
            <Text className="source-version">来源 v{preview.summary.sourceVersion}</Text>
          </View>
          <View className="summary-grid">
            {metrics.map((metric) => (
              <View className="summary-cell" key={metric.key}>
                <Text className="summary-label">{metric.label}</Text>
                <Text className="summary-value">
                  {preview.summary[metric.key]} {metric.suffix}
                </Text>
              </View>
            ))}
          </View>

          <View className={`state-band ${preview.summary.warnings.length ? "warning-band" : "success-band"}`}>
            <Text className="state-title">
              {preview.summary.warnings.length ? "需要补充资料" : "结构检查通过"}
            </Text>
            {preview.summary.warnings.length ? (
              preview.summary.warnings.map((warning) => (
                <Text className="state-copy" key={warning}>{warning}</Text>
              ))
            ) : (
              <Text className="state-copy">当前数据可以生成 v3 隔离预览。</Text>
            )}
          </View>

          <View className="boundary-section">
            <Text className="section-title">本次检查边界</Text>
            <Text className="boundary-row">正式 v2 数据：只读</Text>
            <Text className="boundary-row">v3 预览副本：可重新生成</Text>
            <Text className="boundary-row">页面与 CloudBase：保持现状</Text>
            <Text className="generated-at">检查时间 {preview.generatedAt}</Text>
          </View>
        </>
      ) : (
        <View className="state-band loading-band">
          <Text className="state-title">正在检查本机数据</Text>
          <Text className="state-copy">请稍候，不会修改正式存储。</Text>
        </View>
      )}

      <Button className="inspect-button" onClick={inspect}>重新检查</Button>
    </View>
  );
}
