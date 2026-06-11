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

## A2:Playwright 适配器 + 代理/会话(下一步,需服务器环境)

A1 的缓存是地基。A2 把裸 CDP 升级为工业化采集:
- Playwright 适配器(替代 CDP),封装等待/网络拦截/指纹。
- **代理池**(住宅/数据中心,按平台分池、健康度轮换)。
- **会话/Cookie 管理**(1688/淘宝/Shopee 登录态,会话池轮换降频)。
- **速率治理**(平台/账号/代理三级令牌桶)+ 断路器。
- **验证码人工接管**:检测到滑块/验证 → 入待人工队列 + 通知 → 受控会话回灌。

> A2 的真实跑通需要在自管服务器上配住宅代理 + 真实 Chrome/Playwright,无法在纯 CI 环境验证;接口与解析器(增量扫描/翻页/字段提取,已在 `browser-retrieval` 内并有回归测试)会被复用。

## 合规提醒
平台 ToS 普遍禁止自动化采集,存在账号/IP 封禁风险。缓存、限速、代理只能压低封禁率,**消不掉 ToS 风险**。长期稳态应推进官方 API(Shopee Open Platform / 1688 开放平台),采集作为申请期过渡与补充。见 PRODUCTION-REFACTOR-PLAN.md §13。
