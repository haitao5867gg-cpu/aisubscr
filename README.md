# aisubscr — 通用数字商品商城框架

本地可运行的通用电商演示项目（中文 UI）。用于预览注册登录、商品、下单、模拟支付、订单分享、售后工单、博客与管理后台。

> **范围说明**：本仓库是**通用商城框架**。商品为「示例商品 A/B/C」等占位数据。  
> **不包含**任何第三方账号创建、注册、养殖、转卖、邮箱路由或账号交付逻辑。

## 技术栈

- Next.js 15（App Router）+ TypeScript + Tailwind CSS v4
- Prisma + SQLite
- iron-session（Cookie 会话）
- bcryptjs（密码哈希）
- 可插拔支付接口（当前仅 MOCK 模拟支付）

## 快速开始

```bash
npm install
cp .env.example .env   # 已有 .env 可跳过
npm run db:setup       # prisma db push + seed
npm run dev            # http://0.0.0.0:3000
```

管理后台账号写在（已 gitignore，勿提交）：

`ADMIN_CREDENTIALS.txt`

## 功能一览

| 模块 | 说明 |
|------|------|
| 注册 / 登录 | 邮箱 + 密码，密码哈希存储，会话 Cookie |
| 商品 | 列表 / 详情，人民币标价（¥） |
| 购物车 / 下单 | 会话购物车 → 生成订单 |
| 支付 | WeChat / Alipay 选项走 **MOCK 模拟支付** |
| 订单 | 待支付 / 已支付 / 已完成 / 已退款；可续费商品可生成续费单 |
| 订单分享 | `/order/<publicToken>` 公开状态页（不可猜测 UUID） |
| 售后 | 用户对订单建工单，支持线程回复 |
| 博客 | 文章列表 + 详情；后台可发布 |
| 管理后台 | 商品、订单（手动退款/完成）、工单回复、文章、站点设置 |
| 站点设置 | 站点名、客服邮箱、服务时间、页脚文案 |

## 目录结构（简要）

```
prisma/          schema + seed
src/app/         App Router 页面与 API
src/components/  UI 组件
src/i18n/        文案（现仅 zh，可扩展 en）
src/lib/         db / auth / session / payments
src/app/globals.css  主题 CSS 变量（便于后续换肤）
```

## 什么是模拟的（MOCK）

- **支付**：`src/lib/payments/` 为可插拔接口。微信 / 支付宝目前全部落到 `MOCK` 提供商，页面明确标注「模拟支付」，不会真实扣款。正式接入需商户凭证后再挂真实 Provider。
- **商品 / 文章**：seed 写入的示例数据。
- **客服邮箱 / 服务时间**：站点设置中的占位值（默认 `support@example.com`，`08:00–23:00`）。

## 主题 / 深色模式

- CSS 变量集中在 `src/app/globals.css`（canvas / surface / primary / success 等 light+dark token）
- 页头提供 **系统 / 浅色 / 深色** 切换与 **中文 / English** 语言开关（locale 存 localStorage，文案字典在 `src/i18n/`）
- 视觉参考 modelwool 的轻仪表盘风格；布局参考订单页信息结构（非抄袭文案）

## 主题与后续换肤

样式集中在 `src/app/globals.css` 的 CSS 变量（`--primary`、`--background`、`--radius` 等）。  
后续可按 [modelwool.com](https://modelwool.com/) 视觉规范与订单页布局规范整体替换 token，无需改业务逻辑。

## 脚本

- `npm run dev` — 开发服务器 `0.0.0.0:3000`
- `npm run build` / `npm start` — 生产构建与启动
- `npm run db:setup` — 推送 schema 并 seed

## License

Private / 项目自用。
