# STATUS - fishery-manager-miniprogram

> 最后更新：2026-06-14
> 仓库：`https://github.com/wuj29684-afk/fishery-manager-miniprogram`
> 来源：`fishery-manager/miniprogram/`

## 当前状态

- 当前分支：`main`
- 当前提交：`cd3546a feat: add miniprogram source`
- 小程序 AppID：`wxa516d96010f19988`
- 体验版版本号：`0.1.0-mvp`
- 体验版：已上传并通过用户真机验证
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
npx tsc --noEmit
NODE_ENV=production npm run build:weapp
```

此前已通过：

- domain smoke checks
- TypeScript 类型检查
- Taro production weapp build
- 微信开发者工具编译、预览
- 用户真机扫码体验版验证

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

1. 补齐正式审核前材料：隐私政策、用户协议、服务类目、体验路径和截图素材。
2. 增加“关于与数据说明”页面，明确本地存储、隐私边界和联系方式。
3. 设计生产级数据模型迁移，为后续微信登录和云端同步做准备。
4. 在正式确认前，不提交正式审核，不正式发布。
