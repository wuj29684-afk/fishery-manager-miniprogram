# 微信小程序发布前复核清单

> 当前状态：备案与微信认证已通过；线上正式版为 `0.2.9`。`0.3.0` 已于 2026-07-23 上传并提交微信代码审核，当前等待审核结果，尚未正式发布。

## 基础信息

- AppID：`wxa516d96010f19988`
- 小程序名称：渔儿小助手
- 当前定位：面向 1-5 个塘口或网箱的单人、家庭式养殖户的现场经营工具
- 当前技术边界：首屏直接进入首页，浏览体验示例、创建塘口和本机记录均无需登录；账号同步只在“数据与设置”页由用户主动选择，通过微信云开发按当前微信账号隔离保存塘口和记录。不接支付、定位、文件上传、图片上传或 AppSecret。

## 待复核材料

### 服务类目

- 确认小程序公众平台后台的服务类目是否覆盖养殖经营记录、生产管理或农业相关工具属性。
- 类目说明需与实际功能一致，避免描述为电商、支付、医疗诊断或药品交易。
- 提审/发布前截图保存后台已配置类目。

### 隐私政策

- 明确当前版本默认把经营数据保存在本机微信小程序本地存储。
- 明确用户主动点击“绑定本机数据到账号”时，会通过微信云开发把塘口和记录同步到当前微信账号。
- 明确用户主动点击“使用账号数据”时，会拉取当前微信账号下的云端塘口和记录；覆盖本机前会二次确认。
- 明确账号同步按微信云开发 OPENID 隔离，客户端传入的 ownerUserId 不作为授权依据。
- 明确当前版本不采集定位、手机号、微信头像昵称或支付信息。
- 如后续接入客服、统计、多成员协作或独立后端服务，需先更新隐私政策再提审。

### 用户协议

- 说明当前工具用于养殖经营记录和数据复盘，不替代专业养殖、兽药或财务判断。
- 说明用户应自行备份重要本地数据；使用账号同步前建议先复制 JSON 备份。
- 说明当前线上版暂无在线客服。

### 功能说明

- 首页现场值守与经营概览：无需登录即可查看空白首页、打开本地体验示例或创建养殖单元。
- 塘口与网箱管理：新增、编辑、停用、永久删除和查看详情。
- 记录管理：投料、水质、用药、收获、抽样、死亡和经营支出的新增、编辑和删除。
- 数据备份：复制 JSON 备份、导入 JSON 恢复、复制 CSV 记录，以及用户主动选择的账号同步。
- 关于与数据说明：解释版本能力、数据存储方式和隐私边界。

### 体验路径

建议审核体验路径：

```text
首页 -> 养殖单元 -> 创建塘口或网箱 -> 快速记录 -> 记录 -> 我的/数据与设置
```

体验说明建议强调：

- 打开即进入首页，不需要输入手机号、头像昵称或单独账号密码；本机浏览和记录无需登录。
- 账号同步仅在“数据与设置”页由用户主动选择，使用当前微信身份隔离数据。
- 不需要支付、上传文件、授权定位或填写真实联系方式。
- 默认数据写入当前设备本地小程序存储；用户主动绑定或拉取时，塘口和记录会按当前微信账号同步到微信云开发。

### 截图素材

- 免登录首页截图。
- 首页现场值守与经营概览截图。
- 养殖单元列表和新增网箱表单截图。
- 快速记录表单截图。
- 塘口详情和记录历史截图。
- 数据备份页面截图。
- 关于与数据说明页面截图。

截图前请确认：

- 页面无白屏。
- 页面无明显文字溢出。
- 微信开发者工具 Console 无持续错误。
- 示例数据不包含真实隐私信息。

### 版本备注

建议版本备注：

```text
0.3.0：重构五栏导航与双模式首页，新增塘口/网箱统一管理、网箱尺寸与投放信息、五页签详情和中等密度记录表单；保留首屏免登录、本机优先和用户主动账号同步，不请求手机号、头像或昵称，不包含支付、定位、文件上传、图片上传或 AppSecret。
```

## 提审/发布前验证

- 在 `miniprogram/` 下运行 `npm run check:domain`。
- 在 `miniprogram/` 下运行 `npm run check:about-data`。
- 在 `miniprogram/` 下运行 `npx tsc --noEmit`。
- 在 `miniprogram/` 下运行 `NODE_ENV=production npm run build:weapp`。
- 使用微信开发者工具重新编译并预览。
- 真机跑通建议体验路径。

## 明确不做

- 不擅自提交正式审核。
- 不擅自正式发布。
- 不接入支付。
- 不接入除微信云开发账号同步外的其他网络请求。
- 不要求或保存 AppSecret。
- 不提交 `node_modules/`、`dist/`、`.swc/`、`.env`、密钥文件或证书文件。
## Future Account Sync Gate

- Before any future login or cloud sync submission, update the privacy policy and user agreement to describe account data handling.
- Future cloud sync must isolate ponds, records, weekly reports, backups, and sync revisions by authenticated user account.
- Do not submit a login/cloud-sync version until server-side authorization ignores client-provided owner IDs and filters every query by the verified session owner.

## 0.2 Cloud Sync Upload Gate

- Confirm Vercel API is deployed over HTTPS and backed by Neon Postgres migrations.
- Confirm `DATABASE_URL`, `WECHAT_APP_ID`, `WECHAT_APP_SECRET`, `SESSION_SIGNING_SECRET`, and `WECHAT_OPENID_HASH_SALT` are set only in Vercel environment variables.
- Confirm the API HTTPS domain is configured in WeChat Mini Program request valid domains before uploading a cloud-sync build.
- Confirm real-device flow: login, bind local data to account, restart, pull account data, and verify only the current account data appears.
- Do not upload `0.2.0` until the above checks pass and the user explicitly confirms upload.

## 0.2 CloudBase Sync Upload Gate

- Keep the Vercel + Neon implementation as a future independent-backend route; it is not the default 0.2 route while no independent API domain is available.
- Confirm a WeChat CloudBase environment is created and bound to AppID `wxa516d96010f19988`.
- Confirm `TARO_APP_CLOUDBASE_ENV_ID` is set for the mini program build.
- Confirm cloud function `syncAccountData` is deployed from `cloudfunctions/syncAccountData`.
- Confirm real-device flow: bind local data to account, restart or use another device, pull account data, and verify only the current WeChat account data appears.
- Confirm a second WeChat account cannot read the first account's ponds or records.
- Do not upload `0.2.0` until CloudBase deployment, real-device verification, and explicit user confirmation are complete.
