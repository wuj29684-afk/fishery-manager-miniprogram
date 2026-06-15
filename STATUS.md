# STATUS - fishery-manager-miniprogram

> 最后更新：2026-06-15
> 仓库：`https://github.com/wuj29684-afk/fishery-manager-miniprogram`
> 来源：`fishery-manager/miniprogram/`

## 当前状态

- 当前分支：`main`
- 当前提交：以远端 `main` 最新提交为准
- 小程序 AppID：`wxa516d96010f19988`
- 体验版版本号：`0.1.1reviewprep`
- 体验版：已上传，最新 `0.1.1reviewprep` 已通过用户真机验证
- 正式审核/正式发布：未提交、未发布
- 技术栈：Taro + React + TypeScript

## 已完成功能

- 首页本地经营驾驶舱
- 塘口创建、编辑、停用、详情
- 投料、水质、用药、收获记录
- 记录编辑与删除，删除有二次确认
- 本地存储持久化
- 首页塘口搜索与状态筛选
- JSON 备份复制
- JSON 导入恢复，恢复前有格式校验和二次确认
- CSV 记录导出复制
- 关于与数据说明页
- 审核前材料清单

## 当前边界

当前版本仍是本地数据 MVP，不包含：

- 微信登录
- 支付
- 真实网络请求
- 文件或图片上传
- 定位
- AppSecret
- 正式审核
- 正式发布

AppSecret 只能放在服务端，不能写入小程序代码、配置、日志或仓库。

## 验证命令

```bash
npm install
npm run check:domain
npm run check:about-data
npx tsc --noEmit
NODE_ENV=production npm run build:weapp
```

此前已通过：

- domain smoke checks
- about/data smoke checks
- TypeScript 类型检查
- Taro production weapp build
- 微信开发者工具编译、预览
- 用户真机扫码体验版验证
- 2026-06-15：微信开发者工具上传成功，开发/体验版版本号为 `0.1.1reviewprep`（原计划 `0.1.1-review-prep`，开发者工具版本号字段会过滤连字符）；仍未提交正式审核，仍未正式发布
- 2026-06-15：用户已扫码体验最新 `0.1.1reviewprep` 体验版并确认没问题
- 2026-06-15：首页完成“清晨渔场经营舱”质感升级：新增主视觉、今日经营概览、主行动区、今日值守、增强塘口卡、最近记录和本地数据信任条；本次仅提交代码，尚未上传新的体验版

## Git 安全边界

不要提交以下内容：

```text
node_modules/
dist/
.swc/
.env
*.key
*.jks
*.keystore
AppSecret
```

## 后续方向

1. 继续补齐正式审核前材料：隐私政策、用户协议、服务类目、体验路径和截图素材。
2. 设计生产级数据模型迁移，为后续微信登录和云端同步做准备。
3. 在正式确认前，不提交正式审核，不正式发布。

## 最新增量

- 首页新增“关于与数据”入口。
- 新增 `src/pages/about-data/` 页面，说明当前版本能力、数据存储方式、隐私边界、体验版状态和后续规划。
- 新增 `docs/miniprogram-review-checklist.md`，用于正式审核前准备服务类目、隐私政策、用户协议、功能说明、体验路径、截图素材和版本备注。
- 新增 `npm run check:about-data`，验证页面路由、首页入口、必要边界文案和审核清单。
- 首页从单一工作台升级为更丰富的清晨渔场经营驾驶舱，补充轻量 JPG 视觉资产并保留本地数据边界。
