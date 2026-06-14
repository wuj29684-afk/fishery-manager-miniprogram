import type { FarmState, RecordShortcut } from "../types";

const now = "2026-06-11T00:00:00.000Z";

export const seedFarmState: FarmState = {
  version: 1,
  ponds: [
    {
      id: "pond-1",
      name: "1号高位池",
      species: "南美白对虾",
      location: "广东湛江 麻章区",
      areaMu: 8.5,
      day: 42,
      status: "active",
      createdAt: now,
      updatedAt: now
    },
    {
      id: "pond-2",
      name: "2号罗非鱼塘",
      species: "罗非鱼",
      location: "广西南宁 武鸣区",
      areaMu: 10,
      day: 67,
      status: "active",
      createdAt: now,
      updatedAt: now
    }
  ],
  records: [
    {
      id: "record-feed-1",
      pondId: "pond-1",
      type: "feed",
      date: "2026-06-11",
      weightKg: 120,
      unitPriceYuan: 8.5,
      note: "早晚两餐，吃料正常",
      createdAt: now
    },
    {
      id: "record-water-1",
      pondId: "pond-1",
      type: "water",
      date: "2026-06-11",
      ph: 8.8,
      dissolvedOxygen: 3.6,
      ammoniaNitrogen: 0.2,
      note: "pH 偏高，增氧机延长 2 小时",
      createdAt: now
    },
    {
      id: "record-drug-1",
      pondId: "pond-2",
      type: "drug",
      date: "2026-06-10",
      drugName: "底改片",
      dosage: "2 袋",
      withdrawalDays: 7,
      note: "傍晚泼洒",
      createdAt: now
    },
    {
      id: "record-harvest-1",
      pondId: "pond-2",
      type: "harvest",
      date: "2026-06-09",
      weightKg: 460,
      unitPriceYuan: 22,
      note: "试捕出鱼",
      createdAt: now
    }
  ]
};

export const shortcuts: RecordShortcut[] = [
  { id: "feed", title: "投料", detail: "记录饲料重量与单价" },
  { id: "water", title: "水质", detail: "记录 pH、溶氧、氨氮" },
  { id: "drug", title: "用药", detail: "记录药品、剂量、休药期" },
  { id: "harvest", title: "收获", detail: "记录出鱼重量与售价" }
];
