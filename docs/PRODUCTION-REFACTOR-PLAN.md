# 生产级重构计划 — Sea Launch AI（全 live）

> 状态:提案（v1，2026-06-10）
> 目标形态:**内部工具 / 小团队自用**(非多租户 SaaS)
> 数据路线:**浏览器采集基建化**(官方 API 缺位,live 数据靠自建采集层)
> 部署:**云服务器自管**(延续 Docker,补齐 DB/缓存/采集集群)
>
> 这份文档是从「hackathon MVP」走到「可长期跑、数据真实、不靠人盯」的施工蓝图。
> 它替代 CLAUDE.md 里"24h MVP / seed 优先"的取舍 —— 那些铁律完成了历史使命,这里重新定调。

---

## 0. 一句话目标与验收

把 `/api/run` 从「同步串行、seed 兜底、跑完即弃」重构为:**异步任务化、全 live 数据、有持久化与可观测性、单点失败可降级、采集层工业化**的内部运营系统。

**总验收标准(Definition of Done):**

1. 任意合法 brief 提交后,7-agent 全程使用 **live 数据**(Shopee/1688/淘宝采集 + 真实 FX + 真实物流 + 真实图像),无 seed 兜底、无静态返回。
2. 一次 run 是**异步任务**:提交立即返回 `run_id`,前端轮询/订阅进度,worker 后台执行,崩溃可重试、可恢复。
3. 所有 run 的输入、各 agent 输出、工具调用、采集快照、最终 RunResult **持久化到数据库 + 对象存储**,可查询、可回放、可审计。
4. 采集层能在**反爬、限流、验证码、账号风控**下稳定产出,有代理池、会话管理、缓存、退避与人工接管通道。
5. 有**认证、密钥托管、限流、SSRF 防护**;有**日志、指标、追踪、告警**;关键路径有**断路器与降级**。
6. CI 跑 lint+typecheck+单测+集成测试;有 staging 环境;部署可一键回滚。

---

## 1. 现状 → 目标 差距表

| 维度 | 现状(hackathon) | 目标(生产) |
|------|------------------|-------------|
| 执行模型 | 同步 in-request,`await` 串行 7 agent,`maxDuration=300` | 异步 job queue + worker 池,提交即返回,进度流式 |
| 数据真实性 | shopee/1688/fx/shipping = **seed-only**;browser/image 可 live | **全部 live**;采集层为 1688/淘宝/Shopee 主数据源 |
| 持久化 | 文件系统 audit(`.runs/` 或 `/tmp`),run 结果不入库 | Postgres(run/agent/audit)+ 对象存储(截图/生成图)+ Redis(队列/缓存) |
| 采集 | 单个 CDP Chrome,本机 `:9222`,无代理无会话 | Playwright 集群 + 代理池 + 会话/Cookie 管理 + 缓存 + 验证码接管 |
| 可靠性 | 一个 agent 失败 → 整条 500,无重试无降级 | per-agent 重试/超时/断路器,部分失败产出 partial + blocked |
| 安全 | API 无认证无限流;截图曾入 public/;SSRF 部分修 | Token/SSO 认证、限流、密钥托管(Vault/SOPS)、SSRF 全面收敛 |
| 可观测性 | `console.error`,无指标无追踪 | 结构化日志 + Prometheus 指标 + OpenTelemetry 追踪 + 告警 |
| 成本控制 | 无 token 预算、无缓存,每次全量 LLM + 采集 | 数据缓存(TTL)、LLM 结果缓存、token 预算、并发与速率限额 |
| 前端 | 双 Next 应用,内存态,刷新即丢 | 保留双应用;run 状态从后端恢复;SSE/WebSocket 进度 |
| 测试/CI | 仅 contract + tsc + 单测 | + 集成/契约/采集解析回归 + e2e 冒烟 + staging |
| 部署 | docker-compose(api+frontend) | + Postgres + Redis + 采集 worker + 反代/TLS + 备份 + 回滚 |

---

## 2. 目标架构

```
                          ┌─────────────────────────────────────────┐
                          │                Nginx / Caddy             │
                          │   TLS · 同源收敛 · /api /generated 反代   │
                          └───────────────┬─────────────────────────┘
              ┌───────────────────────────┼───────────────────────────┐
              │                           │                           │
        ┌─────▼──────┐             ┌──────▼───────┐            ┌───────▼────────┐
        │  Frontend  │             │   API (Next) │            │  Static/Object │
        │  (Next 16) │  ──POST──▶  │  /api/runs   │            │  截图·生成图    │
        │            │  ◀─SSE/poll │  enqueue +   │            │  (S3/MinIO)    │
        └────────────┘             │  status/audit│            └────────────────┘
                                   └──────┬───────┘
                                          │ enqueue(run_id)
                                   ┌──────▼───────┐
                                   │    Redis     │  队列 + 缓存 + 速率限额
                                   │  (BullMQ)    │
                                   └──────┬───────┘
                                          │ consume
                    ┌─────────────────────▼──────────────────────┐
                    │            Orchestrator Worker(s)           │
                    │   逐 agent 执行 · 进度上报 · 重试/断路器     │
                    │   ┌─────────────────────────────────────┐  │
                    │   │ market sourcing margin risk listing │  │
                    │   │        packaging committee          │  │
                    │   └──────────────┬──────────────────────┘  │
                    └──────────────────┼─────────────────────────┘
                          ┌────────────┼─────────────┬───────────────┐
                    ┌─────▼─────┐ ┌────▼────┐  ┌──────▼─────┐  ┌──────▼──────┐
                    │  OpenAI   │ │ Scrape  │  │   FX API   │  │ Easyship/   │
                    │ Responses │ │ Service │  │ (live)     │  │ 物流 API    │
                    └───────────┘ └────┬────┘  └────────────┘  └─────────────┘
                                       │
                            ┌──────────▼───────────┐
                            │  采集集群(独立服务)  │
                            │ Playwright workers ×N │
                            │ 代理池 · 会话 · 缓存  │
                            │ 验证码接管 · 速率治理 │
                            └──────────┬───────────┘
                                       │
                          ┌────────────▼────────────┐
                          │   Postgres(主存储)      │
                          │ runs/agents/audit/cache  │
                          │ suppliers/listings/snaps │
                          └──────────────────────────┘
```

核心拆分:**API(轻,只入队+查询)** / **Orchestrator worker(跑管道)** / **采集服务(独立进程,可单独扩容)** / **Postgres+Redis+对象存储**。把采集独立成服务是关键 —— 它资源消耗大、失败率高、需要独立扩缩容和独立的反爬治理,不能和 LLM 编排挤在一个进程。

---

## 3. 数据真实性策略(逐源)

这是"全 live"的核心。每个数据源给出**首选路线 + 退路 + 现实风险**。

### 3.1 Shopee(市场需求/竞品)
- **首选:Shopee Open Platform 官方 API**(需注册开发者 + 绑定卖家账号)。`shop/item/search` 类接口可拿 listing、价格、销量、评分。合规、稳定、有配额。
- **退路:采集**(`shopee.sg/search`)。Shopee 对无头浏览器反爬极强(设备指纹、行为验证、登录墙),需真实指纹浏览器 + 住宅代理 + 会话保活,且**随时可能被封**。
- **建议:官方 API 为主,采集仅作补充**(评论文本、广告位标签等 API 拿不到的)。`scores.demand` 用 API 真实销量替代现有 review-density 代理。
- **风险:** 官方 API 审核周期(数周)、配额;采集触发风控有封号风险。**写入 ToS 风险登记(§13)。**

### 3.2 1688 / 淘宝(货源)
- **首选:1688 开放平台 / 阿里巴巴中国站 API**(`alibaba.cn.*`,需企业资质 + 类目权限)。拿 offer、价格阶梯、起订量、库存、供应商资质。
- **退路:采集**。1688 反爬中等,淘宝最强(滑块+登录)。现有 CDP 路线(增量扫描+翻页)已是退路雏形,但需基建化(§4)。
- **关键修复:1688 GBK 关键词编码**。现状只硬编码 2 个查询,生产必须引入 `iconv-lite` 做完整 GBK 编码,否则任意中文词搜不到。
- **建议:1688 官方 API 为主,淘宝采集为零售比价补充**(淘宝零售价是 wholesale 比价参考,非货源)。

### 3.3 FX 汇率
- **首选:实时汇率 API**(如 open.er-api.com / exchangerate.host / Wise API)。CNY→SGD、USD→CNY 实时拉取。
- **缓存:** 汇率 6–24h TTL 即可(无需每 run 拉),带 `captured_at` 与过期告警。
- **现状:** seed 文件 + 30 天过期警告 —— 直接换成 API + Redis 缓存。

### 3.4 物流报价
- **首选:Easyship API**(代码已有 467 行 live provider,只差接线 + key)。已通过 `LOGISTICS_PROVIDER=easyship` 可开。
- **补充:** Shopee 官方运费计算器(若走 Shopee API)、其他货代 API。
- **修复:** Easyship provider 的 origin 自由文本匹配要复用 seed 的 `matchesRegion`,否则 live 切换即抛错(已在 review 标注)。

### 3.5 商品图像
- **现状已 live**:OpenAI 图像生成。生产保留,但:① 失败默认报错(已修);② 加合规审查升级为真实 vision 检查(现状是 prompt 关键词子串匹配,审计里却标 `mode:"live"` —— 误导);③ 生成图入对象存储(S3/MinIO)而非容器本地 public/。

### 3.6 Web Trend(趋势佐证)
- **首选:** 正经搜索 API(Bing/Google Programmable Search/SerpAPI)替代采集 Google(现已移除 google.com 白名单)。
- 低优先级,可后置。

**数据真实性总原则:** 每个 provider 输出必须带 `source.mode` ∈ {api, scrape, cache},`captured_at`,以及可回溯的原始快照 ID。**任何源都不再有 seed 兜底**;拿不到就诚实返回 `available:false` + warning,由 agent 决定降级,而不是伪造。

---

## 4. 采集基建化(你选的主路线,重点)

把现有「单个 CDP Chrome」升级为独立的**采集服务**。

### 4.1 技术选型
- **Playwright**(替代裸 CDP):内置等待、网络拦截、多浏览器、指纹插件生态。封装为 `POST /scrape`(内部 gRPC/HTTP)接口,输入 `{platform, query|url, pages, purpose}`,输出归一化结构 + 快照。
- 把现有 `browser-retrieval` 的解析器(增量扫描、翻页合并、去重、详情字段提取)**移植**到采集服务,解析逻辑是资产,保留并加回归测试。

### 4.2 反爬与稳定性
- **代理池:** 住宅/数据中心代理(如 Bright Data / Oxylabs / 自建),按平台分池,失败自动轮换,记录每代理健康度。
- **指纹与会话:** 真实 UA + 视口 + 时区 + 语言;持久化 Cookie/会话(尤其 1688/淘宝/Shopee 登录态),会话池轮换避免单账号高频。
- **速率治理:** 每平台/每账号/每代理三级令牌桶,夜间/分散调度,避免行为突刺。
- **验证码/风控接管:** 检测到滑块/验证码 → 不硬闯(现有 `isAccessChallenge` 已是基础)→ 入「待人工」队列,推送通知(可接 Twilio/Slack/邮件),人工在受控会话里过验证后回灌会话。
- **退避与熔断:** 平台连续失败 → 断路器打开,暂停该平台采集 N 分钟,降级到缓存数据并标记 stale。

### 4.3 缓存(关键降本)
- 采集结果按 `(platform, normalized_query, page)` 缓存到 Postgres/Redis,**TTL 分级**:搜索结果 6–24h,详情页 1–3 天,供应商资质 7 天。
- 同一 brief 反复跑、多 agent 复用同一搜索 → 命中缓存,既降本又减少触发风控。
- 缓存条目带 `captured_at`,agent 可读到新鲜度并据此调置信度。

### 4.4 合规缓冲
- 尊重 `robots.txt`(可配置)、限速、不抓个人隐私字段、截图脱敏(现有 `redactText` 扩展到图像区域遮罩)。
- 采集服务独立部署便于单独限流/下线,降低主系统连带风险。

### 4.5 集群与扩缩
- 采集 worker 无状态(会话存 Redis/DB),按队列深度水平扩容。
- 浏览器实例池化复用,设并发上限防 OOM(Chromium 吃内存);独立机器/容器,和 LLM 编排隔离。

---

## 5. 执行模型重构(异步任务化)

### 5.1 队列 + worker
- 引入 **BullMQ(Redis)** 或 **pg-boss(Postgres)**。`POST /api/runs` 只做:校验 brief → 建 run 记录(status=queued)→ 入队 → 返回 `run_id`(202)。
- **Orchestrator worker** 消费队列,逐 agent 执行,每步更新 DB 进度 + 推送 SSE。
- 解决现状「`maxDuration=300` 杀进程、长任务卡在请求里」的根本问题。

### 5.2 进度与恢复
- run 状态机:`queued → running(agent_x) → completed | failed | partial`。
- 前端从轮询升级为 **SSE/WebSocket** 订阅进度(保留轮询作退路);刷新页面从后端 `GET /api/runs/:id` 恢复,不再内存即弃。
- worker 崩溃 → 任务可重入(幂等:已完成的 agent 跳过,从断点续);超时单 agent 而非整 run。

### 5.3 并发与隔离
- 限制全局并发 run 数(防 OpenAI/采集配额打满);per-run 资源预算(token、采集次数、时长)。
- 采集调用走采集服务队列,和 LLM 调用解耦,互不阻塞。

---

## 6. 持久化

### 6.1 Postgres 模型(草案)
- `runs`(id, brief, status, started_at, finished_at, error, cost_summary)
- `agent_runs`(run_id, agent_key, status, input_snapshot, output, model_responses, tool_calls, started_at, finished_at)
- `tool_calls`(agent_run_id, tool, input, output, source_mode, captured_at, snapshot_id)
- `scrape_cache`(platform, query_norm, page, payload, captured_at, expires_at)
- `suppliers` / `listings` / `competitors`(可选,沉淀可复用的领域数据)
- `snapshots`(id, url, text_hash, screenshot_object_key, captured_at)
- 用 **Prisma** 或 **Drizzle** 做 schema + 迁移(类型安全,契合现有 TS 严格度)。

### 6.2 对象存储
- 截图、生成图 → S3 兼容存储(生产用云 S3,自管用 **MinIO**)。DB 只存 object key + 元数据。解决现状「图入容器 public/ 公网可读 + 跨容器 404」。

### 6.3 Redis
- 队列、采集缓存热层、速率令牌桶、会话池、分布式锁(防同 run_id 并发)。

---

## 7. 可靠性

- **per-agent 重试 + 退避**(已有重试雏形,补抖动 + 上限),区分可重试(超时/模型抖动/采集临时失败)与不可重试(契约违例)。
- **断路器**:对 OpenAI / 采集 / FX / 物流每个外部依赖加断路器,连续失败短路 + 降级。
- **部分失败产出**:一个非关键 agent 失败 → 该 slice 标 `blocked` + 理由,管道继续,产出 partial RunResult(契约允许的前提下),而不是整 run 丢弃几分钟成果(review 的 High 项)。
- **超时分层**:工具级、agent 级、run 级三层 deadline,用 AbortSignal 贯穿(review 已修 withTimeout race,生产再下沉到每个 provider fetch)。
- **幂等**:run_id 唯一约束(DB),重入跳过已完成 agent。

---

## 8. 安全

- **认证**:内部工具 → 最简 **API token / Basic + 反代**,或接团队 SSO(Authentik/Auth0)。`/api/runs` 与 audit 端点全部要鉴权(现状全裸)。
- **限流**:每用户/每 token 的 run 速率与并发上限(防烧钱),反代层 + 应用层双保险。
- **密钥托管**:OpenAI/代理/物流/FX key 从 `.env` 迁到 **SOPS+age** 或 **Vault** 或云 secret manager;CI/部署注入,不落盘明文。
- **SSRF**:采集 URL 白名单 + https-only + 重定向后复检(review 已修主路径),生产再加内网 IP 段拒绝(169.254/10./192.168 等)、DNS rebinding 防护。
- **输入加固**:brief 校验(已修)、采集文本进 prompt 前做来源隔离标注(防注入,review 的 Medium),供应商/竞品文本走 §4 的 token 白名单。
- **审计访问控制**:audit 含完整输入快照,鉴权后才可读;run_id 用 UUID。

---

## 9. 可观测性

- **结构化日志**:pino,每条带 `run_id`/`agent`/`tool`,出 JSON,采集到 Loki/云日志。
- **指标**:Prometheus —— run 时长/成功率、各 agent 耗时、采集成功率/封禁率/缓存命中率、OpenAI token 与花费、队列深度。
- **追踪**:OpenTelemetry,一次 run 的全链路 span(agent→tool→采集→外部 API)。
- **告警**:采集封禁率飙升、OpenAI 错误率、队列积压、断路器打开、花费超阈值 → 推 Slack/邮件。
- **成本看板**:每 run 的 LLM + 采集 + 图像花费落 `cost_summary`,可按天/按品类聚合。

---

## 10. Agent Runtime 加固

- **工具错误回喂**(review 已修 H1)→ 生产补:工具失败的结构化错误进审计 + 指标。
- **上下文/token 预算**(已修 H10 截断)→ 生产补:采集结果默认只回喂精简结构,`text_full` 仅入库;按 agent 设 token 上限并监控。
- **LLM 结果缓存**:同 brief + 同证据 → 缓存 agent 输出(可选,降本)。
- **确定性**:committee 加低 temperature/seed,保结论稳定(review 的 Low)。
- **结构化输出 schema 瘦身**:砍掉强迫模型编造的 `tool_snapshots`/`captured_at` 字段(由 runtime 从审计组装),减 token、去幻觉(review 的 agent 适配项)。
- **模型版本固定**:统一模型默认(已修),生产锁定具体版本号,升级走评测。

---

## 11. 测试与 CI/CD

- **单测**:现有 125 个保留并扩(覆盖新增 /0、部分失败、采集解析回归)。
- **采集解析回归**:把真实页面 HTML 快照存为 fixture,断言解析器产出稳定(页面改版能被测试捕获)。注意:fixture 仅供测试(铁律延续),运行时永不 import。
- **集成测试**:用 testcontainers 起 Postgres+Redis,跑 enqueue→worker→落库 全链路。
- **契约测试**:result.ts ↔ schema ↔ fixture 三向 + RunResult 类型断言(review 已建议)。
- **e2e 冒烟**:Playwright 对前端跑「提交 brief → 看到结果页」(用录制的采集响应,不打真站)。
- **CI**:lint(加 ESLint)+ 双应用 typecheck(已加)+ 单测(已加)+ 集成 + 构建;**staging 环境** + 手动 promote + 一键回滚。

---

## 12. 部署(云自管)

- `docker-compose` 扩到:`nginx` + `api` + `frontend` + `orchestrator-worker` + `scrape-service` + `postgres` + `redis` + `minio`。
- **TLS**:Caddy 自动证书或 nginx + certbot。
- **同源收敛**:前端、`/api`、`/generated` 全走反代同域(解决 CORS 与跨容器图片 404,review 已在 docs 标注为推荐路径)。
- **备份**:Postgres 定时 dump + 对象存储版本化;`.runs` 概念迁入 DB 后无需备份文件系统。
- **配置**:dev/staging/prod 三套 env,密钥走 §8 托管。
- **资源**:采集服务单独机器/容器(吃内存),设 cgroup 限额与重启策略。

---

## 13. 合规与法律风险登记(必须正视)

「全 live + 采集」绕不开的现实,务必知情决策:

- **平台 ToS**:Shopee/1688/淘宝的服务条款普遍**禁止自动化采集**。采集存在账号封禁、IP 封禁、乃至法律函风险。**强烈建议官方 API 优先,采集仅作 API 覆盖不到的补充**,并咨询法务。
- **数据合规**:采集勿存储个人数据(卖家电话/地址);截图脱敏;遵守数据本地化(若涉及)。
- **代理合规**:用合规来源的住宅代理,避免灰色代理。
- **频率与礼貌**:限速、错峰,降低对目标站的负载,既是合规也是反封手段。
- **缓解措施**:本计划的代理池/会话/限速/缓存/人工接管,都是在「采集不可避免时」把风险与封禁率压到最低 —— 但**不能消除 ToS 风险**。

> 决策建议:把 §3 每个源的「官方 API」作为正式路线去申请(即便审核要数周),采集作为申请期的过渡与长期补充。这是唯一能长期稳定跑的姿态。

---

## 14. 分阶段路线图

按「先把地基和真实性做扎实,再上规模」排序。每阶段可独立交付、可演示。

### Phase 0 — 地基(1–2 周)
**目标:把执行和存储从玩具升级到能扛。**
- 引入 Postgres(Prisma/Drizzle)+ Redis + 对象存储(MinIO),compose 扩容。
- run/agent/audit/tool_calls 入库,替代文件系统 audit;截图/生成图入对象存储。
- `/api/runs` 改异步:入队 + 返回 run_id;建 orchestrator worker;前端 SSE 进度 + 刷新恢复。
- 加认证(API token)+ 限流 + 密钥托管(SOPS)。
- **验收**:提交 brief 立即拿 run_id,worker 后台跑完落库,刷新页面能恢复,审计可查。

### Phase 1 — 真实数据:低风险源(1 周)
**目标:把不依赖采集的源全部 live。**
- FX → 实时 API + 缓存;物流 → 接通 Easyship(修 origin 匹配);图像 → 入对象存储 + 真实合规检查。
- margin 用真实货源价/运费(review H2 已部分修,这里坐实数据来源)。
- **验收**:FX/物流/图像三源全 live 且有缓存与新鲜度;margin 瀑布数字与上游一致。

### Phase 2 — 采集服务 MVP(2–3 周)
**目标:把现有 CDP 解析器升级为独立采集服务,先单平台跑通。**
- Playwright 服务化,移植解析器 + 回归 fixture;接缓存层。
- 先做 **1688**(反爬中等):修 GBK 编码,接代理池 + 会话 + 限速 + 断路器。
- orchestrator 的 sourcing agent 改走采集服务(经缓存),seed 退役。
- **验收**:任意中文货源词能 live 采集 1688 并落缓存;触发风控时诚实降级 + 待人工队列。

### Phase 3 — 采集扩展 + 官方 API(3–4 周,并行)
**目标:覆盖 Shopee/淘宝,并启动官方 API 申请。**
- 并行启动 Shopee Open Platform / 1688 开放平台 **申请**(审核期长,尽早动)。
- 采集扩到 Shopee(最难,住宅代理 + 真实指纹必需)、淘宝(零售比价)。
- 验证码人工接管通道打通(通知 + 受控会话回灌)。
- API 批下来后,provider 层做「API 优先、采集兜底」的自动选路。
- **验收**:market/sourcing 全程 live;官方 API 接入后采集降为补充;封禁率与缓存命中率有指标。

### Phase 4 — 可靠性与可观测性(1–2 周)
**目标:不靠人盯也能稳定跑。**
- 断路器、部分失败 partial 产出、三层超时下沉到 provider。
- pino 日志 + Prometheus 指标 + OTel 追踪 + 告警 + 成本看板。
- **验收**:单 agent/单源故障不拖垮整 run;关键异常自动告警;每 run 成本可见。

### Phase 5 — 测试/CI/CD 与硬化(1–2 周)
**目标:可持续演进。**
- 集成测试(testcontainers)、采集解析回归、e2e 冒烟;staging + 一键回滚。
- 安全复审(SSRF 内网段、SSO、审计访问控制);schema 瘦身;模型版本锁定。
- **验收**:CI 全绿门禁;staging 验证后 promote;回滚演练通过。

> 总工期粗估 **8–12 周**(单人;并行/多人可压缩)。Phase 0–2 是「能用且数据真实」的最小生产闭环,Phase 3+ 是规模化与长期稳态。

---

## 15. 立即可做的 5 件事(本周)

1. **决策官方 API**:今天就去注册 Shopee Open Platform + 1688 开放平台开发者,启动审核(最长前置项)。
2. **修 1688 GBK 编码**:引入 `iconv-lite`,解除"只支持 2 个查询"的硬限制 —— 半天工作量,立刻让 1688 采集对任意词可用。
3. **接通 FX + Easyship live**:两个 provider 代码基本就绪,接 key + 缓存,先把两个低风险源转 live。
4. **起 Postgres + 对象存储**:compose 加两个服务,先把 audit 和图片入库/入桶,止住「跑完即弃 + 图片 404」。
5. **采集服务原型**:把 `browser-retrieval` 解析器抽到独立进程 + Playwright,先本地单实例验证 1688,跑通后再加代理池。

---

## 附:与现有 CLAUDE.md 铁律的关系

- 「contract-first」**保留并强化**(加运行时双向类型断言 + 集成测试)。
- 「MVP 范围内才动手」**退役**(MVP 已交付,目标变为生产)。
- 「单一真实路径 / 禁 mock」**升级为「全 live、禁 seed 兜底」** —— 比原铁律更严:连 seed 都不再作运行时数据源,只留作测试 fixture。
- 建议:重构启动后更新 CLAUDE.md 的定调段落,指向本文档。
