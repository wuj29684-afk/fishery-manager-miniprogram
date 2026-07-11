import type { RecordShortcut } from "../types";

export const shortcuts: RecordShortcut[] = [
  { id: "feed", title: "投料", detail: "记录实际投喂和摄食" },
  { id: "water", title: "水质", detail: "记录检测值和采样时间" },
  { id: "drug", title: "用药", detail: "记录用药和休药期" },
  { id: "harvest", title: "收获", detail: "记录出鱼重量与售价" }
];
