import type { DashboardMetric, RecordShortcut } from "../types";

interface MockPondSummary {
  id: string;
  name: string;
  species: string;
  location: string;
  areaMu: number;
  day: number;
  alert: string;
}

export const metrics: DashboardMetric[] = [
  { label: "塘口", value: "2 个", tone: "good" },
  { label: "今日预警", value: "2 条", tone: "warn" },
  { label: "总收入", value: "¥50,600", tone: "good" },
  { label: "净利润", value: "¥-10,400", tone: "danger" }
];

export const ponds: MockPondSummary[] = [
  {
    id: "pond-1",
    name: "1号高位池",
    species: "南美白对虾",
    location: "广东湛江 麻章区",
    areaMu: 8.5,
    day: 42,
    alert: "pH 偏高，溶氧偏低"
  },
  {
    id: "pond-2",
    name: "2号罗非鱼塘",
    species: "罗非鱼",
    location: "广西南宁 武鸣区",
    areaMu: 10,
    day: 67,
    alert: "成本超支，建议复核饲料采购"
  }
];

export const shortcuts: RecordShortcut[] = [
  { id: "feed", title: "投料", detail: "记录饲料重量与单价" },
  { id: "water", title: "水质", detail: "记录 pH、溶氧、氨氮" },
  { id: "drug", title: "用药", detail: "记录药品、剂量、休药期" },
  { id: "harvest", title: "收获", detail: "记录出鱼重量与售价" }
];
