import assert from "node:assert/strict";

const records = [
  { type: "feed", weightKg: 120, unitPriceYuan: 8.5, date: "2026-06-11" },
  { type: "harvest", weightKg: 460, unitPriceYuan: 22, date: "2026-06-09" }
];

const revenue = records
  .filter((item) => item.type === "harvest")
  .reduce((sum, item) => sum + item.weightKg * item.unitPriceYuan, 0);
const feedCost = records
  .filter((item) => item.type === "feed")
  .reduce((sum, item) => sum + item.weightKg * item.unitPriceYuan, 0);

assert.equal(revenue, 10120);
assert.equal(feedCost, 1020);
assert.equal(revenue - feedCost, 9100);

console.log("domain smoke checks passed");
