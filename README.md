# aisubscr — 通用数字商品商城框架

本地可运行的通用电商演示项目（中文 UI）。用于预览注册登录、商品、下单、模拟支付、订单分享、售后工单、博客与管理后台。

> **范围说明**：本仓库是**通用商城框架**。商品为「示例商品 A/B/C」等占位数据。  
> **不包含**任何第三方账号创建、注册、养殖、转卖、邮箱路由或账号交付逻辑。

## 技术栈

- Next.js 15（App Router）+ TypeScript + Tailwind CSS v4
- Prisma + SQLite
- iron-session（Cookie 会话）
- bcryptjs（密码哈希）
- 可插拔邮件（nodemailer SMTP，或未配置时的控制台日志）
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
| 忘记密码 | 邮箱收取 6 位验证码后设置新密码。新密码没有长度或复杂度限制 |
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
prisma/          schema、baseline 迁移、密码重置迁移、登录/注册限流迁移、seed
deploy/          已脱敏的生产笔记、nginx / systemd、备份脚本
src/app/         App Router 页面与 API
src/components/  UI 组件
src/i18n/        文案（zh 与 en）
src/lib/         db / auth / session / mail / payments
src/app/globals.css  主题 CSS 变量（便于后续换肤）
```

## 什么是模拟的（MOCK）

- **支付**：`src/lib/payments/` 为可插拔接口。微信 / 支付宝目前全部落到 `MOCK` 提供商，页面明确标注「模拟支付」，不会真实扣款。正式接入需商户凭证后再挂真实 Provider。
- **商品 / 文章**：seed 写入的示例数据。
- **客服邮箱 / 服务时间**：站点设置中的占位值（默认 `support@example.com`，`08:00–23:00`）。
- **密码重置邮件**：默认 `MAIL_PROVIDER=console`（或未设置且 `SMTP_HOST` 为空）时，**不会发送真实邮件**。验证码写在服务器日志里，前缀 `AISUBSCR_MAIL_CONSOLE`。`MAIL_PROVIDER=smtp` 才走 SMTP。SMTP 发送或配置失败只记错误日志，**不会**改用控制台提供商补发。

## 忘记密码

登录页有「忘记密码?」，打开 `/forgot-password`。

1. 提交邮箱。地址会去掉首尾空白并转成小写，与注册时相同。已注册时返回「验证码已发送到 xxx，请查收（也请检查垃圾箱）」并发送验证码。尚未注册时返回「该邮箱尚未注册，正在跳转到注册页…」，页面跳到 `/register?email=<urlencoded>`，并带上原来的 `next`。注册页读取 `email` 并预填，`next` 仍决定注册成功后的去向。因此这个接口可以判断邮箱是否已注册。未注册的查询不会发信，但会计入该 IP（以及这个邮箱）的发送频率，用来限制枚举。
2. 验证码 6 位，只存 bcrypt 哈希，约 15 分钟过期。同一用户只有一条有效验证码，新的会替换旧的。连续输错 5 次后该验证码作废。
3. 提交验证码和新密码。新密码按提交内容保存，不检查长度或复杂度；空密码会要求重新填写。
4. 成功后删除验证码，并把 `User.sessionVersion` 加 1。iron-session 的登录态在 Cookie 里，其他设备上的旧 Cookie 在下次请求时因版本不一致而视为已退出。
5. 邮件发送失败（SMTP 错误或配置不完整）时返回「发送失败，请稍后再试」。页面停在发送步骤并显示该错误，不会进入已发送状态。未发出的验证码记录会被删掉。

同一邮箱、同一 IP 发送间隔约 60 秒，并且每小时最多约 5 次。超过限制时返回「发送过于频繁，请稍后再试」，这条响应不说明邮箱是否注册。IP 的取法见下面「访客 IP」。站点在 Cloudflare 后面时，仍建议把 `deploy/nginx-cloudflare-realip.conf` 包含进 TLS 的 server 块，这样 `X-Real-IP` 就是访客地址。

## 登录与注册频率限制

限制存在 SQLite（`AuthRateEvent`），重启后仍然有效。登录和注册分开计数。

| 动作 | 邮箱 | IP |
|------|------|----|
| 登录失败 | 15 分钟最多 5 次 | 15 分钟最多 20 次 |
| 注册 | 约 60 秒 1 次，并且每小时最多 5 次 | 与邮箱相同 |

登录只记录失败。密码正确不受这次限制，输错一次也可以马上再试，直到达到上面的次数。未注册的邮箱同样计次，避免用「是否被限制」判断邮箱是否存在。超过后返回「尝试次数过多，请稍后再试」（HTTP 429，带 `Retry-After`）。

注册每次请求都计数（包括该邮箱已经注册）。超过后返回「注册过于频繁，请稍后再试」，这条响应不说明邮箱是否注册。

## 访客 IP

应用只信任本机 nginx 转发过来的地址：

1. `X-Real-IP` 已是访客地址时用它。直连源站时，伪造的 `CF-Connecting-IP` 不能覆盖它。
2. `X-Real-IP` 是 Cloudflare 边缘地址时，用 `CF-Connecting-IP`。
3. 否则从 `X-Forwarded-For` 的右侧取第一个不是代理的地址。客户端写在左侧的值不采用。

## 安全响应头与会话

页面响应带 Content-Security-Policy（脚本按请求 nonce，样式保留 `'unsafe-inline'`，因为页面使用 React 的 `style` 属性）、`X-Frame-Options: DENY`、`frame-ancestors 'none'`、`Referrer-Policy`、`X-Content-Type-Options: nosniff`、`Permissions-Policy`。请求是 HTTPS（或 `X-Forwarded-Proto: https`）时再加 HSTS。本地 HTTP 开发不会升级到 HTTPS。

会话 Cookie 名 `aisubscr_session`：`HttpOnly`、`SameSite=Lax`、`Path=/`，生产环境 `Secure`。生产环境的 `SESSION_SECRET` 必须至少 32 位，且不能是 `.env.example` 里的占位符或代码里的开发回退值，否则进程拒绝签发会话。

管理页面在服务端布局里检查登录和 `ADMIN`。管理 API 同样在处理数据前调用 `requireAdmin()`。角色每次从数据库读取，不单独信任 Cookie 里的旧角色。未登录返回 401，已登录但不是管理员返回 403。模拟支付完成改为仅订单本人可 POST，避免别人凭订单号把订单标成已支付。

## 支付提供商

默认 `PAYMENT_PROVIDER=mock`。结算页上的微信 / 支付宝只是记下支付方式，确认时仍走 `src/lib/payments/mock.ts`，不会扣款。

订单状态：`PENDING` → `PAYING`（已发起支付）→ `PAID` → `COMPLETED`，以及 `REFUNDING` / `REFUNDED` / `CANCELLED` / `FAILED`。允许的流转在 `src/lib/payments/states.ts`。

真实渠道以后接到同一接口上：

- `PaymentProvider.createPayment` 创建支付
- `verifyNotification` 先验签。微信 / 支付宝默认没有验签函数，通知一律拒绝
- 商户代码调用 `setPaymentSignatureVerifier` 和 `setPaymentNotificationParser`
- `POST /api/payments/notify/[provider]` 把验过的通知交给 `confirmOrderPayment`
- 同一 `(provider, eventId)` 只会入账一次，记在 `PaymentNotice`

模拟通知（仅当设置了 `PAYMENT_WEBHOOK_SECRET`）对原始 body 做 HMAC-SHA256，十六进制放在 `x-payment-signature`。Body 示例：`{"orderNo":"AS…","amountCents":9900,"eventId":"evt_1","method":"MOCK","success":true}`。

占位变量见 `.env.example` 的 `PAYMENT_*`、`WECHAT_PAY_*`、`ALIPAY_*`。不要把真实商户密钥写进仓库。生产升级只跑 `npx prisma migrate deploy`（新增 `PaymentNotice`），不要 seed。

## 给中国大陆访客的静态资源

页面不引用 Google Fonts、Google 脚本、unpkg、jsdelivr 或 Gravatar。正文字体是系统字体（苹方、微软雅黑、Noto Sans SC 等），避免下载整套中文字体。`/_next/static` 使用带内容哈希的长期 `Cache-Control` 和 `CDN-Cache-Control`，方便 Cloudflare 缓存。HTML 带一次性 CSP nonce，响应是 `private, no-store`，边缘不要缓存页面。

## 环境变量

见 `.env.example`。密码重置相关：

| 变量 | 作用 |
|------|------|
| `MAIL_PROVIDER` | `console` 或 `smtp`。空则在设置了 `SMTP_HOST` 时用 smtp，否则 console |
| `MAIL_FROM` | 发件人，smtp 必填 |
| `SMTP_HOST` | 如 `smtp.mx.cloudflare.net`、`smtp.resend.com`、`smtp.gmail.com` |
| `SMTP_PORT` | 默认 `587`；Cloudflare Email Sending 用 `465` |
| `SMTP_SECURE` | `true` 为隐式 TLS（465）。不填时端口 465 视为 `true` |
| `SMTP_USER` / `SMTP_PASS` | Cloudflare 用户名固定为 `api_token`，密码为 Email Sending: Edit 令牌 |

Cloudflare Email Sending 尚未开通时保持 `MAIL_PROVIDER=console`。真实邮件不会发出。

## 生产数据库升级

当前生产库由 `prisma db push` 建成，里面有真实数据，且仓库原先没有迁移历史。迁移：

- `20261109120000_baseline`：升级前的表结构
- `20261109120500_password_reset`：给 `User` 增加 `sessionVersion`（`ALTER TABLE`，默认 0），并新建验证码表。不重建用户表，不删除已有行
- `20261110120000_auth_rate_events`：新建 `AuthRateEvent`，供登录失败和注册频率限制。不改已有表

**不要**在生产运行 `npm run db:seed`、`npm run db:setup` 或 `npx prisma db seed`。seed 会重置管理员密码。

已有生产库执行（先备份，再标记 baseline，再应用新迁移）：

```bash
cd /opt/aisubscr
/usr/local/sbin/aisubscr-backup
npx prisma migrate resolve --applied 20261109120000_baseline
npx prisma migrate deploy
npm run build
systemctl restart aisubscr
```

`migrate resolve --applied` 只写入一条「baseline 已经应用」的记录，不改表、不改数据。`migrate resolve` 在这台库上只跑一次。之后的版本只跑 `npx prisma migrate deploy`。

如果还没 resolve 就直接 `npx prisma migrate deploy`，Prisma 会因数据库非空而停止（P3005），不会改数据。

全新空库（没有用过 `db push`）不需要 resolve：

```bash
npx prisma migrate deploy
```

本地演示仍可 `npm run db:setup`（`db push` + seed）。那条命令只适合空的本地库。

## 主题 / 深色模式

- CSS 变量集中在 `src/app/globals.css`（canvas / surface / primary / success 等 light+dark token）
- 页头提供 **系统 / 浅色 / 深色** 切换与 **中文 / English** 语言开关（locale 存 localStorage，文案字典在 `src/i18n/`）
- 页面结构按数字商品商城来排：方案、结算、个人中心、订单与售后。颜色、圆角、字体、阴影和按钮沿用现有 token。

## 主题与后续换肤

样式 token 集中在 `src/app/globals.css`（`--primary`、`--canvas`、`--radius`、`--shadow-soft` 等）。  
换肤改这些变量即可。页面布局是商城自己的结构，不要再套用资讯站或第三方订单站的版式。

## 脚本

- `npm run dev` — 开发服务器 `0.0.0.0:3000`
- `npm run build` / `npm start` — 生产构建与启动
- `npm run db:setup` — 本地推送 schema 并 seed（生产不要跑，会重置管理员密码）
- `npx prisma migrate deploy` — 按 `prisma/migrations` 升级数据库（生产用，不含 seed）

## License

Private / 项目自用。
