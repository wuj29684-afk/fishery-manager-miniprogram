# STATUS - fishery-manager-miniprogram

> 最后更新：2026-07-14
> 仓库：`https://github.com/wuj29684-afk/fishery-manager-miniprogram`
> 来源：`fishery-manager/miniprogram/`

## 当前状态

- 当前分支：`main`
- 当前提交：以远端 `main` 最新提交为准
- 小程序 AppID：`wxa516d96010f19988`
- 版本状态：线上正式版为 `0.2.6`；`0.2.7` 已上传为开发/体验版本，尚未提交审核、尚未正式发布
- 正式版：`0.2.6` 已于 2026-07-12 正式发布上线
- 正式审核/正式发布/微信认证：小程序备案与微信认证已通过；后续审核提交、正式发布、上传覆盖、扫码、验证码、人脸等敏感动作必须由用户当次确认或亲自操作
- 技术栈：Taro + React + TypeScript

## 当前下一步

1. 优先完成 `0.2.7` 真机回归，确认体验示例不会通过账号进入或手动绑定写入云端，同时正常经营数据仍可同步。
2. 回归通过后，再经用户当次明确确认提交 `0.2.7` 审核；审核通过后仍需单独确认正式发布。
3. 规划 `0.2.8` 依赖安全加固，重点处理 `wx-server-sdk` 间接依赖的高风险安全公告；不得直接执行破坏性自动降级。

## 状态维护规则

- 本文件顶部“当前状态”和“当前下一步”是唯一权威当前状态。
- 每次上传体验版、提交审核、审核结果变化、正式发布或改变同步/数据边界时，必须在同一轮工作中同步更新两份 `STATUS.md` 顶部。
- 日期标题下的旧内容仅作为历史记录；若其中使用“当前”“仍为”“审核中”等易误读措辞，必须改为明确的过去时，或直接删除。
- 结束每轮项目工作前必须搜索并清理与顶部结论冲突的旧版本号、审核状态和后续计划，再确认两个工作区状态。

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

## 2026-07-11 Mini Program 0.2.5 account-first redesign

- 登录页全新设计：单按钮「微信授权登录进入」+ 智能数据判断 + 底部离线入口。
- 点击登录后自动检测云端/本机数据状态：两端都有时弹出方向选择、仅云端有则提示恢复、仅本机有则提示绑定、都没有直接进入空白首页。
- 登录页支持优雅降级：同步失败自动进入本机数据，不阻塞用户。
- 数据模型升级为 FarmState v2，新增养殖批次、品种预警模板、自定义阈值、抽样、死亡、经营支出和专业扩展字段。
- 本地 v1 数据与 v1 JSON 备份可迁移到 v2；迁移前保存恢复副本；损坏数据停止覆盖写入。
- 云同步协议 v2：分页、完整性摘要、删除标记、baseRevision 冲突检测和 0.2.4 旧协议兼容。
- 首页、塘口详情和周报统一使用同一预警引擎；休药期按日期计算，休药期内收获需要再次确认。
- 独立仓已通过 domain v2 checks、about/data v2 checks、TypeScript、CloudBase 云函数 7 项测试和 production weapp build。
- 2026-07-11：已通过 CLI 部署 syncAccountData v0.2.5 云函数（Nodejs20.19, Active, 7 tests passing）。
- 2026-07-11：已通过 CLI 上传 0.2.5 体验版（408.2 KB），上传备注 `account-redesign: 全新登录页 单按钮微信授权 智能判断云端本机数据`。
- 2026-07-11 约 17:17：用户确认已在微信开发者工具手动覆盖上传修复后的 `0.2.5` 体验版，备注 `data-safety-fix: recovery point and conflict guard`；该体验版已包含云端恢复前本机恢复点和绑定冲突检查。
- 2026-07-11 开发者工具无损验证：普通编译后首屏登录页正常；离线入口可进入首页；登录连接能返回云端/本机同步方向菜单；选择“暂不处理，进入本机”后首页及现有塘口、记录正常显示，未触发云端或本机覆盖。
- 此条为 `0.2.5` 阶段历史记录：当时尚未真机验证或提交审核；后续 `0.2.6` 已提交审核，线上正式版仍为 `0.2.4`。

## 2026-07-09 WeChat certification passed

- 用户告知小程序微信认证已通过。
- 当前关键线上条件已齐备：备案已通过、`0.2.4` 已正式发布、微信认证已通过。
- 后续优先验证：微信内搜索完整名称 `渔儿小助手`、小程序分享入口、以及认证后 24-48 小时内搜索索引是否刷新。
- 本次仅记录认证状态，不涉及代码修改、构建、上传或正式发布操作。

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

## 2026-07-11 0.2.5 体验反馈 UI 精简（本地待上传）

- 根据体验反馈完成登录入口精简：仅保留“使用微信账号数据进入”和“暂不登录，直接进入”两个动作；账号入口负责读取或绑定账号数据，本机入口不触发同步。
- 首页调整为轻量经营入口，移除“今日值守”“本周经营”和底部最近记录列表；保留异常提示、当前塘口、四类快速记录和塘口列表。
- 新增独立“记录”页面，集中查看、筛选和编辑所有现场记录，首页不再堆叠历史记录。
- 新装用户不再展示原始演示塘口和演示记录；仅在数据完全吻合旧系统示例时安全清除，不影响用户自建数据。
- 塘口详情新增永久删除：经两次确认后删除塘口及关联记录，并写入同步删除标记；原“停用”功能继续保留。
- 主仓与独立仓已镜像核对一致。主仓与独立仓均已通过领域检查、说明页检查、TypeScript、云函数 7 项测试和生产构建。
- 本轮仅完成本地实现与验证，未部署云函数、未上传新的体验版、未提交审核、未正式发布。

## 2026-07-11 0.2.5 体验版上传

- 经用户当次确认，已通过微信开发者工具 CLI 成功覆盖上传 `0.2.5` 体验版；AppID 为 `wxa516d96010f19988`，包体约 `413.5 KB`。
- 上传备注：`ui-simplify: login home records delete pond`。
- 上传前已确认开发者工具登录、正式 AppID、版本号、双仓验证和安全扫描；未发现受禁止跟踪文件或真实密钥。
- 该次操作未部署云函数、未提交审核、未正式发布；操作发生时线上版本为 `0.2.4`。

## 2026-07-11 空白首页体验示例（本地预览）

- 空白首页增加双路径：用户可“创建我的塘口”，也可“先看体验示例”。
- 体验示例会在本机创建一个示例对虾塘以及水质、投料、抽样记录，并直接进入塘口详情；可继续编辑，也可通过永久删除清除。
- 示例不会自动出现，也不会覆盖或删除已有用户数据；仅当本机经营数据为空时才可载入。
- 主仓和独立仓均已通过领域检查、说明页检查、TypeScript；独立仓生产构建成功并已触发开发者工具自动编译。
- 本次未上传体验版、未提交审核、未正式发布。

## 2026-07-11 0.2.5 体验示例覆盖上传

- 经用户当次确认，已通过微信开发者工具 CLI 成功覆盖上传 `0.2.5` 体验版；AppID 为 `wxa516d96010f19988`，包体约 `414.9 KB`。
- 上传备注：`empty-state: create or explore example pond`。
- 本次包含空白首页“创建我的塘口 / 先看体验示例”双路径；体验示例仅在本机无经营数据时可载入。
- 用户当时计划自行后续提交审核；该次操作未提交审核、未正式发布，操作发生时线上版本为 `0.2.4`。

## 2026-07-11 常驻体验示例入口（本地预览）

- “数据与设置”新增常驻“体验示例”入口，已有用户也能知道示例功能的位置。
- 本机已有塘口或记录时，入口会说明保护规则，不载入或混入示例数据；本机为空时可直接进入示例对虾塘详情。
- 主仓和独立仓均已通过领域检查、说明页检查、TypeScript；独立仓生产构建及开发者工具自动编译成功。
- 本次未再次上传体验版、未提交审核、未正式发布。

## 2026-07-11 0.2.6 全量数据重置体验版

- 经用户明确确认，`syncAccountData` 云函数已更新部署到 `cloud1-d0gae5atcb0f634b3`；部署成功，包体约 `16.0 KB`。
- 新版采用数据世代隔离：`0.2.6` 首次启动重置旧本机塘口、记录与恢复点；新版同步仅读取新的云端数据世代，旧云端快照对新版不可见。
- 旧云端文档未执行物理批量删除，旧客户端同步路径继续兼容；新版用户不会再恢复旧数据。
- 已成功覆盖上传 `0.2.6` 体验版，上传备注 `data-reset: fresh local and cloud data epoch`，包体约 `417.6 KB`。
- 该次操作未提交审核、未正式发布；操作发生时线上版本为 `0.2.4`。

## 2026-07-11 0.2.6 已提交微信代码审核

- 微信公众平台截图确认：开发版本 `0.2.6` 于 2026-07-11 19:26:50 上传，项目备注 `data-reset: fresh local and cloud data epoch`；该版本于 2026-07-11 19:32:05 提交代码审核。
- 提交当时状态为审核中、尚未正式发布；当时线上版本为 `0.2.4`。
- 后续仅在审核通过后，经用户当次明确确认，才可进行正式发布操作。

## 2026-07-11 0.2.7 体验示例同步保护（已上传）

- 双仓完整检查通过：domain、about/data、TypeScript、生产构建和 CloudBase 云函数 8 项测试。
- 审查发现体验示例虽标记为“仅保存在本机”，但在云端为空时可能被账号进入或手动绑定上传；已在两条同步入口阻止体验示例写入账号。
- 2026-07-11 约 23:22：已通过微信开发者工具上传 `0.2.7` 开发/体验版本，包体 `418.0 KB`，备注 `experience-guard: keep example data local only`。
- 该保护补丁不包含在已提交审核并于 2026-07-12 正式上线的 `0.2.6` 包中；`0.2.7` 目前仍未提交审核、未正式发布。

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

## 2026-07-12 0.2.6 正式发布上线

- 用户已完成 `0.2.6` 正式发布，当前正式线上版本为 `0.2.6`。
- 主仓另有 `0.2.7` 未提交审核的开发/体验版本记录；该体验版不改变 `0.2.6` 的正式线上状态。
- 后续体验版覆盖、审核提交与正式发布仍需用户当次明确确认。
