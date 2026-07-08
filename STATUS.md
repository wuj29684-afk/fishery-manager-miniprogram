# STATUS - fishery-manager-miniprogram

> 最后更新：2026-07-08
> 仓库：`https://github.com/wuj29684-afk/fishery-manager-miniprogram`
> 来源：`fishery-manager/miniprogram/`

## 当前状态

- 当前分支：`main`
- 当前提交：以远端 `main` 最新提交为准
- 小程序 AppID：`wxa516d96010f19988`
- 线上版本号：已正式发布 `0.2.4`；登录页绑定入口与 CloudBase 启动容错修复已通过真机预览、体验版上传并正式上线
- 正式版：用户于 2026-07-08 告知 `0.2.4` 已正式发布上线
- 正式审核/正式发布：小程序备案已通过；当前 `0.2.4` 已正式发布上线；后续新版本提交审核、正式发布、扫码、验证码、人脸等敏感动作必须由用户确认或亲自操作
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
- 首屏账号进入，登录时拉取账号数据或绑定本机数据
- 微信云开发账号同步，按当前微信账号隔离塘口和记录
- 关于与数据说明页
- 审核前材料清单

## 当前边界

当前版本为本机优先 + 微信云开发账号同步正式线上版，不包含：

- 支付
- 文件或图片上传
- 定位
- AppSecret

除用户主动触发的微信云开发账号同步外，不接入其他网络请求。账号同步使用当前微信身份静默识别，不要求输入手机号、头像昵称或单独账号密码。

AppSecret 只能放在服务端，不能写入小程序代码、配置、日志或仓库。

## 2026-07-06 CloudBase 0.2.2 account entry readiness

- Added `pages/account-login/index` as the first mini program page.
- The account entry page lets the user enter with the current WeChat account, pull account data at login, or bind local pond/record data to the current account after confirmation.
- Updated “关于与数据说明” to `0.2.2 体验版` and updated the review path to start with `账号进入`.
- Updated upload/review checklist wording for `0.2.2`: first-screen account entry, login-time sync, current-WeChat identity, no phone/avatar/password, no payment, no location, no file/image upload, no AppSecret.
- Fresh verification passed: `npm run check:about-data`, `npm run check:domain`, `npx tsc --noEmit`, and production `npm run build:weapp` with `TARO_APP_CLOUDBASE_ENV_ID=cloud1-d0gae5atcb0f634b3`.
- Build output confirms `pages/account-login/index` is the first page and `dist/pages/account-login/` files exist.
- Safety checks found no tracked `node_modules/`, `dist/`, `.swc/`, `.env`, key, JKS, or keystore files. Sensitive-term scan found only boundary documentation, environment variable names, and false positives such as CSS `task-*`; no secret value was found.
- WeChat DevTools visual verification confirmed the first screen is `pages/account-login/index` and shows the 0.2.2 account-entry copy.
- WeChat DevTools upload succeeded for version `0.2.2` at about 2026-07-06 10:11 with upload note `login-entry: 首屏账号进入与登录时同步`; the overwrite-experience-version prompt was confirmed after user approval.
- `0.2.2` is uploaded as the experience/development version; it is still not formally released.

## 2026-07-06 CloudBase 0.2.3 account entry fallback hotfix

- User reported that tapping the first-screen “使用当前微信账号进入” failed.
- WeChat DevTools reproduction showed toast `账号同步失败，请稍后重试`; debugger showed `Error: timeout` from the mini program runtime after the CloudBase sync call.
- Added a login-entry fallback: when account sync fails, the page now shows `账号同步暂时失败` with the original error message and a safe `进入本机数据` action, so users are not blocked from local data by a transient cloud sync failure.
- Bumped the mini program package/about-data version to `0.2.3`.
- Fresh verification passed: `npm run check:about-data`, `npm run check:domain`, `npx tsc --noEmit`, and production `npm run build:weapp`.
- WeChat DevTools upload succeeded for version `0.2.3` at about 2026-07-06 14:35 with upload note `sync-fallback: 账号同步超时可进入本机数据`.
- `0.2.3` is uploaded as the experience/development version; it is still not formally released.

## 2026-07-08 CloudBase 0.2.4 login bind fix

- User reported that the first-screen bind action was confusing/unavailable and sync still appeared to fail.
- Cloud function phone logs showed successful pull/push responses, so the failing layer was the mini program login UI/startup path rather than CloudBase data isolation.
- Added a real first-screen `绑定本机数据到账号` button, renamed the main account action to `使用账号数据进入`, and kept `暂不同步，进入本机数据` as a separate local fallback.
- Added better account-sync error extraction for Taro/CloudBase error shapes and made `wx.cloud.init` tolerant of DevTools/runtime timeout so the first page is not blocked by CloudBase init noise.
- Bumped the mini program package/about-data version to `0.2.4`.
- Fresh verification passed: `npm run check:domain`, `npm run check:about-data`, `npx tsc --noEmit`, and production `npm run build:weapp` with `TARO_APP_CLOUDBASE_ENV_ID=cloud1-d0gae5atcb0f634b3`.
- WeChat DevTools current-page preview showed the new three-action login page, and the user scanned the preview and confirmed the bind flow works.
- WeChat DevTools upload succeeded for version `0.2.4` at about 2026-07-08 16:49 with upload note `login-bind-fix: account login bind entry and cloud init tolerance`. The user later confirmed `0.2.4` was formally released online on 2026-07-08.

## 验证命令

```bash
npm install
npm run check:domain
npm run check:about-data
npx tsc --noEmit
NODE_ENV=production npm run build:weapp
```

## 2026-07-04 Local Operating Loop

- Synced local-only pond health rules and weekly report rules from the main mini program source.
- Added a dashboard operating-loop card showing weekly feed, water record count, and current local reminders for the focused pond.
- This change keeps the current boundary: no login, no payment, no real network requests, no upload, no location, no AppSecret, and no formal release.
- Verified with `npm run check:domain`, `npm run check:about-data`, `npx tsc --noEmit`, and `NODE_ENV=production npm run build:weapp`.

此前已通过：

- domain smoke checks
- about/data smoke checks
- TypeScript 类型检查
- Taro production weapp build
- 微信开发者工具编译、预览
- 用户真机扫码体验版验证
- 2026-06-15：微信开发者工具上传成功，开发/体验版版本号为 `0.1.1reviewprep`（原计划 `0.1.1-review-prep`，开发者工具版本号字段会过滤连字符）；仍未提交正式审核，仍未正式发布
- 2026-06-15：用户已扫码体验最新 `0.1.1reviewprep` 体验版并确认没问题
- 2026-06-15：首页完成“清晨渔场经营舱”质感升级：新增主视觉、今日经营概览、主行动区、今日值守、增强塘口卡、最近记录和本地数据信任条；本次已提交代码，并已上传 `0.1.2` 体验版代码
- 2026-06-15：微信开发者工具代码上传成功，版本号 `0.1.2`，项目备注 `rich-home: 丰富首页经营舱体验`；未提交正式审核，未正式发布。
- 2026-06-16：用户已进入正式审核/备案流程，公众平台返回小程序备案平台驳回；经 Chrome 复核，驳回字段为 `小程序名称`，原因是不符合个人备案要求。用户已提交名称修改申请，当前显示名称修改审核中；备案材料预览仍显示旧名称 `渔业养殖智能管家`，暂不提交备案材料，待名称审核通过并同步到材料后再重新提交备案。
- 2026-07-03：用户告知小程序备案已通过；当前记录为备案通过但仍未正式发布。后续可进入正式审核/发布前复核，但不要代替用户执行最终提交、发布、扫码、验证码、人脸等敏感动作。
- 2026-07-03：完成备案后发布前文案复核，已将“关于与数据说明”和审核清单更新为备案已通过、仍未正式发布状态；`package.json` 版本同步为 `0.1.2`。本轮已通过 domain checks、about/data checks、TypeScript 和 production weapp build。
- 2026-07-04：用户确认备案通过后的最终小程序名称为 `渔儿小助手`；已将小程序导航标题、首页标题、关于页产品名和发布前复核清单同步为最终名称。
- 2026-07-04：改名同步版已通过微信开发者工具上传为开发版本 `0.1.3`，上传备注 `sync-name: 渔儿小助手`；本次按用户确认覆盖体验版，随后用户确认已提交微信代码审核，当前等待审核结果，仍未正式发布。

## 2026-07-04 User Asset Isolation Gate

- Future account login and cloud sync work must isolate ponds, records, reports, backups, and sync revisions by authenticated user.
- Added mini program account-sync client skeletons for the next 0.2 phase, but they are not wired into the current UI and do not change the local-only 0.1.3 behavior.
- The current 0.1.3 mini program remains local-only and does not add login, network requests, upload, location, payment, AppSecret, or formal release.
- Verified with `npm run check:domain`, `npm run check:about-data`, `npx tsc --noEmit`, and `NODE_ENV=production npm run build:weapp`.
- Secret scan found only boundary-text references; no real AppSecret, token, env file, or key material was added.

## 2026-07-04 Mini Program Sync Payload Boundary

- Added a pure sync payload builder for the 0.2 client foundation.
- `pushOwnedState` now calls `POST /v1/sync/push`, but remains unwired from UI and does not change current local-only behavior.
- Domain checks prove push payloads strip any local `ownerUserId`; the server remains the source of truth for ownership.
- Verified with `npm run check:domain`, `npm run check:about-data`, `npx tsc --noEmit`, and `NODE_ENV=production npm run build:weapp`.

## 2026-07-04 Cloud Sync 0.2 Upload Readiness Work

- Added account sync controls on the data backup page: bind local data to account, pull account data, API URL gating, and second confirmation before local overwrite.
- Package version is now `0.2.0`.
- Upload still must wait for API deployment, WeChat request valid domain configuration, real-device verification, and explicit user confirmation.
- When `TARO_APP_API_BASE_URL` is not configured as an HTTPS URL, the sync entry stays in an unavailable state and does not send requests.
- Pulling account data into local storage strips server `ownerUserId` fields and keeps the local `FarmState` format at version 1.
- Final local verification for this 0.2 readiness pass: `npm run check:domain`, `npm run check:about-data`, `npx tsc --noEmit`, and production `npm run build:weapp`.
- Safety scan found only boundary documentation and environment variable names; no real AppSecret, token, `.env`, key, JKS, or keystore material was added.

## 2026-07-05 CloudBase Sync Route

- Added WeChat CloudBase as the default 0.2 sync route because no independent HTTPS API domain is currently available.
- Preserved the HTTPS API/Vercel route as fallback when `TARO_APP_API_BASE_URL` is configured and `TARO_APP_CLOUDBASE_ENV_ID` is not configured.
- Added `TARO_APP_CLOUDBASE_ENV_ID`, app-level `wx.cloud.init`, account sync facade, and cloud function `cloudfunctions/syncAccountData`.
- Cloud function sync is isolated by CloudBase `OPENID`; client-provided `ownerUserId` is stripped/ignored.
- Upload remains gated: do not upload `0.2.0` until the CloudBase environment is created, `syncAccountData` is deployed, real-device same-account and second-account isolation checks pass, and the user explicitly confirms upload.

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

## 2026-07-05 CloudBase deployment follow-up

- Created/confirmed WeChat CloudBase environment for the mini program.
- Environment display name: `cloud1`; real EnvID for builds: `cloud1-d0gae5atcb0f634b3`.
- Cloud function `syncAccountData` is visible in CloudBase console and status is `deployed`.
- Deployed local `cloudfunctions/syncAccountData` through WeChat DevTools with cloud-side dependency installation from the main workspace.
- Fixed Taro build constants so `TARO_APP_API_BASE_URL` and `TARO_APP_CLOUDBASE_ENV_ID` are compiled into the weapp bundle instead of leaving runtime `process.env` references.
- Rebuilt with `TARO_APP_CLOUDBASE_ENV_ID=cloud1-d0gae5atcb0f634b3`; DevTools preview no longer shows `process is not defined`.
- Current gate: do not upload `0.2.0` until real-device CloudBase login/sync checks pass, including same-account pull and second-account isolation, and the user explicitly confirms upload.

## 2026-07-06 CloudBase 0.2.0 experience upload

- User explicitly confirmed uploading the `0.2.x` experience build.
- Verified same-account CloudBase pull through WeChat DevTools before upload: `serverRevision: 9`, `ponds: 2`, `records: 4`.
- Rebuilt the mini program with `TARO_APP_CLOUDBASE_ENV_ID=cloud1-d0gae5atcb0f634b3` and `NODE_ENV=production`.
- Upload preflight passed: `npm run check:domain`, `npm run check:about-data`, `npx tsc --noEmit`, and production `npm run build:weapp`.
- Safety scan found no tracked `node_modules/`, `dist/`, `.swc`, `.env`, key, JKS, or keystore files; sensitive-word hits were policy text, environment variable names, and server-side config references only.
- WeChat DevTools upload succeeded for version `0.2.0`; the upload dialog warned this overwrites the current experience version, and the user had already authorized uploading `0.2.x` experience version.
- User scanned and tested the `0.2.0` experience version on a real device and confirmed there were no issues.
- This is still not a formal release. Do not click formal publish/release or submit additional official steps without user confirmation.

## 2026-07-06 CloudBase 0.2.1 copy consistency upload

- Updated the home trust banner, data backup entry copy, About/Data page, release checklist, and status copy so they describe the actual 0.2 behavior: local-first storage plus user-initiated WeChat CloudBase account sync.
- Mini program package version is now `0.2.1`.
- Verified old "local-only/no upload/no network" user-facing copy no longer appears in the current mini program source, smoke script, release checklist, or current STATUS text.
- Upload preflight passed in both mini program repos: `npm run check:domain`, `npm run check:about-data`, `npx tsc --noEmit`, and production `npm run build:weapp` with `TARO_APP_CLOUDBASE_ENV_ID=cloud1-d0gae5atcb0f634b3`.
- Safety scan found no tracked `node_modules/`, `dist/`, `.swc`, `.env`, key, JKS, or keystore files; sensitive-word hits were policy text, environment variable names, and server-side config references only.
- WeChat DevTools upload succeeded for version `0.2.1` with upload note `copy-sync: 修正云同步文案与审核说明`.
- This is still not a formal release. Do not click formal publish/release or submit additional official steps without user confirmation.

## 后续方向

1. 当前 `0.1.3` 已提交微信代码审核，下一步等待审核结果；审核通过后的正式发布、扫码、验证码、人脸等敏感动作必须由用户确认或亲自操作。
2. 若官方最终名称与代码内导航标题不一致，再同步更新小程序内标题、重新构建并上传新开发版本。
3. 继续设计生产级数据模型迁移，为后续微信登录和云端同步做准备。
4. 不要正式发布；不要接入支付、登录、真实网络请求、上传、定位或 AppSecret。

## 最新增量

- 首页新增“关于与数据”入口。
- 新增 `src/pages/about-data/` 页面，说明当前版本能力、数据存储方式、隐私边界、体验版状态和后续规划。
- 新增 `docs/miniprogram-review-checklist.md`，用于正式审核前准备服务类目、隐私政策、用户协议、功能说明、体验路径、截图素材和版本备注。
- 新增 `npm run check:about-data`，验证页面路由、首页入口、必要边界文案和审核清单。
- 首页从单一工作台升级为更丰富的清晨渔场经营驾驶舱，补充轻量 JPG 视觉资产并保留本地数据边界。
- 备案通过后，“关于与数据说明”页和发布前复核清单已同步为 `0.1.3` 改名同步版、已完成备案、仍未正式发布。
