# 采集服务(A 阶段)

> 状态:A1 缓存层已落地(2026-06-10)。这是 [PRODUCTION-REFACTOR-PLAN.md](PRODUCTION-REFACTOR-PLAN.md) §4「采集基建化」的第一块。
> 路线:浏览器采集为 Shopee/1688/淘宝的 live 主数据源(官方 API 后续排期)。

## A1:抓取结果缓存(已完成)

marketplace 抓取慢、失败率高、反爬有风险:同一查询反复抓既费时又抬高撞墙概率。A1 在 `BrowserController` 这层加了**结果缓存**,一次 run 内(及对同一商品的重复 run)复用抓取,而不是反复实抓。

- **`lib/scrape/cache.ts`** — `ScrapeCache` 接口 + `FilesystemScrapeCache`:按 `(purpose, 归一化 url/query)` 键、带 TTL、原子写;`prune()` 清过期。接口留给 A2 换 Redis。
- **`lib/scrape/cached-controller.ts`** — `createCachedBrowserController(inner, cache)`:包裹任意 `BrowserController`,命中 TTL 内的缓存就直接返回(标 `from_cache:true`),否则实抓并写缓存。
  - **TTL 按 purpose 分级**:搜索类 6h、详情/规格类 48h、供应商资质 7 天(详情更稳、搜索更易变)。
  - **登录态抓取(Seller Centre / `requires_human_login`)不缓存** —— 依赖会话、太敏感。
  - 缓存写失败不影响抓取(best-effort);缓存值不持久化截图绝对路径。
- **接入**:`BROWSER_RETRIEVAL_MODE=live` 时,orchestrate 用缓存装饰器包住 CDP controller(`SCRAPE_CACHE=off` 可关)。缓存落 `<audit_root>/scrape-cache/`。

### 配置
- `BROWSER_RETRIEVAL_MODE=live` 启用 live 抓取(默认 seed)。
- `SCRAPE_CACHE=off` 关闭抓取缓存(默认开)。

## A2:托管采集栈(骨架已落地,Playwright 引擎需服务器验证)

A1 的缓存是地基。A2 把裸 CDP 升级为工业化采集,**纯逻辑件已实现并测试覆盖**,Playwright 引擎是动态导入骨架(需服务器装 `playwright` 才能真跑)。

落地的件(全部注入式、可测):
- **令牌桶限速器**(`rate-limiter.ts`):per-key(平台/账号/代理)稳态限速,降低 bursty 流量被风控的概率。
- **断路器**(`circuit-breaker.ts`):平台连续失败 N 次 → open 冷却 → half-open 试探,避免雪上加霜。
- **代理池**(`proxy-pool.ts`):健康轮换,失败代理进冷却并跳过。
- **会话存储**(`session-store.ts`):per-platform cookie/指纹持久化(内存 + 文件系统两实现),登录态复用、人工过验后回灌。
- **验证码人工接管队列**(`handoff.ts`):撞墙→入待人工队列+通知(注入 Slack/Twilio/邮件)→ 不绕过,人工过验后刷新会话。
- **ScrapeEngine 接口**(`engine.ts`)+ **托管 controller**(`managed-controller.ts`):把上面全部串成一条链实现 `BrowserController`:
  `断路器 → 限速 → 代理轮换 → 会话恢复 → engine.capturePage → 撞墙则入接管队列+跳闸+抛错(不绕过) → 成功则刷新会话/上报健康`。代理池配置但耗尽时**抛错而非裸连(不泄露源 IP)**。
- **Playwright 引擎骨架**(`playwright-engine.ts`):实现 `ScrapeEngine`,动态 `import("playwright")`(不入 package.json,~300MB 浏览器);增量扫描/撞墙检测逻辑镜像现有 CDP controller。

### 接入(opt-in,默认不变)
`BROWSER_RETRIEVAL_MODE=live` + `SCRAPE_ENGINE=playwright` 才走托管栈;否则仍是 CDP。两者都会被 A1 缓存包裹。

服务器准备:
```bash
npm i playwright && npx playwright install chromium
```
env 旋钮(见 `lib/scrape/from-env.ts`):`SCRAPE_PROXY_URLS`(逗号分隔)、`SCRAPE_PROXY_COOLDOWN_MS`、`SCRAPE_RATE_BURST`、`SCRAPE_RATE_PER_SEC`、`SCRAPE_CB_THRESHOLD`、`SCRAPE_CB_COOLDOWN_MS`、`SCRAPE_HEADLESS`。

> **未在此环境验证的部分**:真实 Playwright 起浏览器、对真实 Shopee/1688/淘宝抓取、指纹/会话/撞墙选择器的实际有效性 —— 这些必须在自管服务器配代理 + Chrome 后校准。骨架的注入式逻辑(限速/断路/代理/会话/接管/串联)已全部单测覆盖。

## 合规提醒
平台 ToS 普遍禁止自动化采集,存在账号/IP 封禁风险。缓存、限速、代理只能压低封禁率,**消不掉 ToS 风险**。长期稳态应推进官方 API(Shopee Open Platform / 1688 开放平台),采集作为申请期过渡与补充。见 PRODUCTION-REFACTOR-PLAN.md §13。
