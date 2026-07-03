import fs from "node:fs";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function readText(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function assertIncludes(text, expected, label) {
  if (!text.includes(expected)) {
    throw new Error(`${label} must include: ${expected}`);
  }
}

const appConfig = readText("src/app.config.ts");
const homePage = readText("src/pages/index/index.tsx");
const aboutPagePath = path.join(root, "src/pages/about-data/index.tsx");
const reviewChecklistPath = [
  path.join(root, "docs/miniprogram-review-checklist.md"),
  path.join(root, "../docs/miniprogram-review-checklist.md")
].find((candidate) => fs.existsSync(candidate));

if (!fs.existsSync(aboutPagePath)) {
  throw new Error("about-data page must exist");
}

if (!reviewChecklistPath) {
  throw new Error("review checklist must exist");
}

const aboutPage = fs.readFileSync(aboutPagePath, "utf8");
const reviewChecklist = fs.readFileSync(reviewChecklistPath, "utf8");

assertIncludes(appConfig, "pages/about-data/index", "app config");
assertIncludes(homePage, "/pages/about-data/index", "home page");
assertIncludes(homePage, "关于与数据", "home page");

[
  "当前数据仅保存在本机微信小程序本地存储",
  "当前版本不上传服务器，不接入真实网络请求",
  "当前体验版暂无在线客服",
  "AppSecret 只能放在服务端",
  "0.1.2 体验版",
  "已完成备案"
].forEach((copy) => assertIncludes(aboutPage, copy, "about-data page"));

[
  "服务类目",
  "隐私政策",
  "用户协议",
  "功能说明",
  "体验路径",
  "截图素材",
  "版本备注"
].forEach((item) => assertIncludes(reviewChecklist, item, "review checklist"));

console.log("about/data smoke checks passed");
