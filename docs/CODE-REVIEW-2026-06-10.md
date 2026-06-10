# 全仓代码审查报告 — 2026-06-10

> 范围:`app/` + `lib/`(runtime、7 agents、providers)+ `contract/` + `frontend/` + CI/部署/docs。
> 维度:健壮性 / 安全性 / 功能完整性 / 功能可用性 / agent 适配性。
> 方法:4 个并行审查 agent 分区通读源码 + 真实 live run 审计(`.runs/run_full-1780838533`)交叉验证,高危结论已逐条人工核对源码确认。
> 基线 commit:`ebf5fd0`。

## Summary

骨架质量不错:contract-first 在前后端都真正落地、风险红线分层(确定性层兜底 LLM)、审计/回放、committee 降级路径都成型。但存在 **5 个 Critical** 问题:其中 3 个直接违反 CLAUDE.md 铁律 3(live 管道实际全程吃 seed 数据)、1 个会毁掉 demo 高潮(Committee 页硬编码 GO 82%,剧本要的是 Watch)、1 个让文档宣称的部署方式根本跑不通(无 CORS)。另有一批 High 级问题集中在"一个环节失败 → 整条 2-4 分钟管道全损"和数据断链(margin 无视 sourcing 真实产出)。

---

## Critical(5)

| # | 位置 | 维度 | 问题 |
|---|------|------|------|
| C1 | `lib/agents/orchestrate.ts:46-51` | 功能完整性/铁律3 | **`/api/run` 实际全程使用 seed providers**。`createOrchestrationProviders()` = `{...createSeedProviders(), openaiImage: live}`,shopee/1688/fx/shipping/browser 全部读 `seed/*.json`。live Chrome provider(`createChromeBrowserRetrievalProvider`)只被测试引用,从未接入管道。CLAUDE.md 宣称"只走真实 pipeline、禁止静态返回"与现实不符。修法:把 browser/shipping 等 live provider 按 env 接进 `createOrchestrationProviders`,或修订 CLAUDE.md 的声明。 |
| C2 | `lib/agents/orchestrate.ts:39` | 功能完整性 | `shipping: createSeedShippingProvider()` 硬连 seed,绕过了 `createShippingProviderFromEnv()`。`.env.example` 默认 `LOGISTICS_PROVIDER=easyship` **完全无效**,467 行的 Easyship live provider 是死代码。一行修复:改用 `createShippingProviderFromEnv()`。 |
| C3 | `lib/providers/shopee/index.ts:50`、`sourcing-1688/index.ts:23`、`browser-retrieval/index.ts:138,228` | 功能完整性/铁律3 | **查询不匹配时静默返回吸尘器 seed 数据冒充搜索结果**:`queryMatches.length ? queryMatches : seed.products`。用户输入"瑜伽垫",market/sourcing/margin 全链路拿桌面吸尘器数据推理,且 `query` 字段原样回显伪装相关。修法:不匹配时返回空结果 + `SEED_QUERY_MISMATCH` warning(Taobao seed 路径已是诚实返回 `[]` 的正确示范)。 |
| C4 | `frontend/src/app/app/committee/page.tsx:47-49` | 功能可用性 | **Committee 页硬编码 `<DecisionChip decision="go" />` + "Confidence 82%"**,完全不读 `runResult.committee`。demo 剧本的高潮是"给 Watch 不给 Go",这页永远显示 GO 82%,当场穿帮。weights/conflicts 也全是假数据。修法:从 store 取真实 committee 输出渲染。 |
| C5 | `app/api/run/route.ts`(全文件)+ `docker-compose.yml:33` | 功能可用性 | **API 无任何 CORS 头/OPTIONS 处理**,而 docker-compose 默认 `NEXT_PUBLIC_API_BASE_URL=http://localhost:3000` 让 :3001 前端跨源 POST(JSON 必触发 preflight)→ 浏览器直接拦截。DEPLOY.md §2 的 split-port 用法跑不通,只有 §3 nginx 同域那条路能活;且该 URL 在 build 时烧进客户端 bundle,云部署后访问者会去连自己的 localhost。修法:API 加 CORS 或把 nginx 标为必选 + base URL 默认同源。 |

## High(11)

| # | 位置 | 维度 | 问题 |
|---|------|------|------|
| H1 | `lib/agent-runtime/run-agent.ts:323-335` + `tool-runner.ts:60` | agent适配/健壮 | 工具错误从不回喂模型:`throwOnError` 默认 true,模型幻觉工具名或传错参数(`TOOL_NOT_ALLOWED`/`TOOL_INPUT_INVALID`)直接炸掉 attempt,且这些 code 不可重试 → 整条管道 500。tool-runner 精心构造的 `{ok:false}` 分支是死代码。修法:`executeAllowedTool(..., {throwOnError:false})`,把错误作为 `function_call_output` 回喂让模型自救。 |
| H2 | `lib/agents/margin/index.ts:34-40` + `assumptions.ts:37` | 功能完整性 | **Margin 完全无视 sourcing 真实产出**:`source_price_cny: 15.8`、运费、重量全部硬编码。真实 run 已出现同屏矛盾:opportunity 的 `source_price: 3.58`(sourcing 真实值)vs margin 瀑布 Source price ≈2.91。任何品类都算出同一套利润。修法:用 sourcing output 覆盖 BASE_ASSUMPTIONS 的对应字段。 |
| H3 | `lib/agents/market/index.ts:260-266` + committee `weights.ts:7-13` | 功能完整性 | `scores.compliance` 和 `scores.packaging` 在 live 管道**恒为 0**(没有任何 agent 回写),committee 30% 的权重是死区,`computeOverall` 上限 ≈70,deterministic fallback 的 Go 阈值(≥70)几乎不可达,非 primary 候选恒被判 Reject。修法:listing 回写 compliance、packaging 回写 packaging 分。 |
| H4 | `app/api/run/route.ts:22-31` + `docker-compose.yml:9-10` | 安全性 | `/api/run` 无认证无限流,单请求烧 2-4 分钟 OpenAI 配额 + live 图像生成;docker-compose 直接绑 0.0.0.0。任何拿到 URL 的人可用 curl 循环烧光预算。修法:至少加共享 token header + 并发上限。 |
| H5 | `lib/providers/openai-image/index.ts:220-245` | 铁律3 | live 图像生成失败时**静默回退 seed SVG**(吞掉所有错误),run 照常成功、上架包带着罐头图。与 route 层"无 key 就 503"的哲学矛盾。修法:rethrow 或 env 显式开启 fallback。 |
| H6 | `app/api/run/route.ts:13` + `run-agent.ts:223-231` + `orchestrate.ts:99-132` | 功能可用性 | 时间预算超标:4 个 LLM agent 串行,每个最高 2 attempt × 180s,仅 market 一个的最坏情况(360s)就超过 `maxDuration=300`,Vercel 杀进程后客户端拿到裸 504,audit 永远停在 "running"。修法:管道级总预算(AbortSignal 下发)+ 低剩余时砍重试。 |
| H7 | `lib/providers/browser-retrieval/index.ts:861-872` + `chrome.ts` | 安全性(SSRF) | 域名白名单只校验**初始 URL**,Chrome 跟随重定向后不复检;`google.com` 在默认白名单里,开放重定向(`google.com/url?q=...`)可让服务端浏览器打内网/云 metadata(169.254.169.254);协议也未限制。修法:capture 后对 `scanned.url` 复检白名单 + 仅允许 https + 移除 google.com。 |
| H8 | `chrome.ts:43-44,63-70` | 安全性 | 截图默认写到 `public/generated/browser-snapshots/` — **未认证公网可读**,而 `market_shopee_ads` 明确是登录态 Seller Centre 截图;`redact_sensitive` 只脱敏文本,截图从不脱敏。修法:截图改写 `.runs/`(已 gitignore 且不被静态服务),经认证路由提供。 |
| H9 | `chrome.ts:312-373` | 健壮性 | `CdpClient.send()` 无超时、socket 无 `close` 处理(只有 `error`),Chrome 进程死掉时 pending promise 永不 settle → 整条 run 挂死到 300s;`connect` 同样可能永久挂起;`createTarget` 成功后 `connect` 失败会泄漏 tab(try/finally 包不到)。修法:per-command 超时 + close 监听 reject 所有 pending + connect 包进 try。 |
| H10 | `run-agent.ts:319,333` + browser 结果含 `text_full`(150k) | agent适配 | 工具输出无截断直灌上下文,且每轮把上一响应全部 output items 回灌;browser 工具同时返回 `text_excerpt`(25k)和 `text_full`(150k)给模型 — 单次调用可注入 ~45k token,几次搜索即超窗(400 可重试 → 烧双倍)。修法:回喂模型前剥掉 `text_full`、截断输出并标 `truncated:true`(audit 保留全量)。 |
| H11 | `frontend/src/app/app/history/page.tsx:47-52` + `adapters.ts:126` | 健壮性 | `<Image src={item.heroImage}>` 无空值守卫,adapter 对非 selected 机会填 `""` → 真实 run 后 History 页 4/5 卡片空 src,next/image 直接抛错整页崩溃(board 页有守卫,history 漏了)。studio 页 `ImageModule` 同病。修法:加 `{item.heroImage && ...}` 守卫或占位图。 |

## Medium(摘要,18)

| 位置 | 维度 | 问题 |
|------|------|------|
| `route.ts:72-101` | 安全/健壮 | brief 零校验(类型/长度/未知键),5MB 字符串可直灌 prompt(注入+token 成本),错误要到整条管道跑完才在 contract 校验暴露 |
| `run-agent.ts:458-483` | 健壮 | `withTimeout` 只 abort 不 race-reject;工具不查 `signal` 时照样挂死 |
| `errors.ts:113-115` | 健壮 | `MODEL_OUTPUT_PARSE_FAILED` 不可重试(与专为它写的 retry 提示语矛盾);schema 失败反而可重试 — 不对称 |
| `audit-root.ts:10-12` | 可用 | Vercel 上 audit 落 per-instance `/tmp`,POST 与轮询 GET 不同实例 → War Room 渐进视图在主部署目标上 404 |
| `orchestrate.ts:121-125` | 完整 | margin/packaging/committee/risk 没接 audit;envelope 仅在成功后写快照 — 失败的 agent 零审计记录;committee 的 `model_responses` 恒空(已用真实 run 验证) |
| `route.ts:49` + `audit.ts:201-212` | 安全 | 客户端 run_id 不查重/不验归属,可覆写他人审计;audit GET 无认证可枚举读取全量输入快照 |
| `orchestrate.ts:132` + 各 agent `assertAgentSuccess` | 健壮 | 无 per-agent 降级,一个 agent 失败 → 已花的几分钟 LLM 产出全丢、整体 500(roadmap 要求 blocked 降级未实现) |
| `margin/calculator.ts:66,76` | 健壮 | `netProfit/sellingPrice` 无 0 保护,LLM 给 0 价 → NaN 直到 contract 校验才炸;`minimumViablePrice` 可返回 Infinity |
| `sourcing/index.ts:287-308` | 健壮 | 上游无 primary 时静默捏造 "Mini Desk Vacuum" 默认方向继续跑 |
| `listing/index.ts:731` + `packaging/index.ts:173` | 完整 | 从 `ctx.results` 找 risk 产出,但 risk 在 orchestrate 里排最后 → `risk_warnings` 在 live 管道恒为 `[]`,docs/AGENTS.md 宣称的输入是死的 |
| `committee/skill.ts:12` + `index.ts:58-70` | 安全/完整 | 硬红线(hard_block 必 Reject)纯 prompt 软约束,代码不复核;LLM 给 hard_block 打 Go 会原样进 contract。建议事后断言降级 deterministic |
| `packaging/local-preference.ts:144-176` | 安全 | 抓取的竞品标题切词后直拼进 listing 文案和图像 prompt,仅黑名单过滤 — 注入面 |
| `risk/claims.ts` vs `listing` vs `lib/compliance/claims.ts` | 完整 | 三份互不一致的违禁词表("industrial-grade" vs "industrial grade"),子串匹配漏报/误伤("uncertified" 命中 "certified") |
| `contract/result.schema.json:133-182` | contract | schema 弱于 result.ts:`committee.weights`/`compliance`/`variations`/`logistics` 是裸 object/array,缺字段也能过校验 |
| `contract/fixtures/sample-result.json:174-190` | contract | 瀑布加总 3.47 ≠ net_profit 3.37;GST 9% 按 11.9 应 ~1.07 而非 0.40;fixture 图片 `.png` 实际只有 `.svg`(UI 渲染 404) |
| `.github/workflows/contract-check.yml` | 基建 | CI 只跑 fixture↔schema 最小校验;根/前端的 typecheck、vitest 全不在 CI — "CI 绿即可 merge" 等于盲 merge |
| `browser-retrieval/index.ts:1068` | 可用 | 1688 GBK 编码只硬编码 2 个查询,其余中文词发出去是乱码 → 0 行 → throw;live 1688 只对 demo 品有效 |
| `docker-compose.yml:21` | 可用 | healthcheck 打 `/`,根应用无页面路由恒 404 → api 容器永远 unhealthy;CLAUDE.md"单仓单应用"与 frontend/ 双应用(Next 14 vs 16)现实脱节,TASKS.md 还在指向不存在的根路由 |

## Low(摘要)

模型默认值双处定义且与 CLAUDE.md 不符(代码 `gpt-5.5`,文档 `gpt-4o`,且 strict schema 用了老模型不支持的 `minimum/const`);500 响应泄漏内部错误且服务端无日志;`?images=false` 会意外跑 live 图像;audit route 的 `/` 硬编码在 Windows 上全 404;market schema 强迫模型编造 `tool_snapshots`/`captured_at` 等随即被丢弃的字段(token 浪费);FX seed 无时效告警;`redactText` 把 8 位以上数字串(商品 ID/销量)误打成 `[redacted-phone]`;committee 请求无 temperature/seed,彩排与正式 demo verdict 可能不同;`startRun` 不防双击(双倍烧钱);前端长 POST 无超时/watchdog,刷新即丢状态;dashboard/upload 页硬编码假数据冒充 AI 产出;`seed/market`、`seed/margin` 等目录无人引用(孤儿);warning code 两种命名风格;frontend dev 脚本不带 `-p 3001` 与后端抢端口。

---

## 五维度结论

- **健壮性 ★★☆☆☆**:单点失败全损(H1/H6/Medium 多条)、超时不强制(withTimeout)、CDP 挂死(H9)。核心问题是"快乐路径工程"——错误路径基本没有降级设计。
- **安全性 ★★☆☆☆**:密钥卫生很好(历史+当前零泄漏),路径遍历防得标准;但无认证+无限流的烧钱 API(H4)、SSRF 重定向(H7)、登录态截图公网可读(H8)三个都需要在任何公网部署前修掉。
- **功能完整性 ★★☆☆☆**:最重 — "live 管道"实际是 seed 管道(C1/C2/C3),margin 数据断链(H2),30% 评分权重死区(H3),risk 输入死线。文档与代码大面积脱节。
- **功能可用性 ★★★☆☆**:本机 nginx 同域路径能跑通 demo 主线(真实 run 已验证 Watch + 12.4% 出现在产物里);但 Committee 页穿帮(C4)、跨源部署死(C5)、History 崩溃(H11)都在 demo 必经之路上。
- **agent 适配性 ★★★☆☆**:strict schema 封装(`makeObjectSchema` required-all + nullable 可选)是对的;但工具错误不回喂(H1)、上下文无预算(H10)、强迫模型编造元数据字段,这三个是多 agent 系统的通病级缺陷。

## What looks good

contract-first 真正落地(前后端都从 `contract/result.ts` 取型,运行时 `assertValidRunResult` 强制校验,fixtures 仅测试引用);风险红线分层正确(demo 关键红线在确定性层,LLM 只能加险不能消险,有真实 payload 回归测试);committee 三态降级路径完善且有定向测试;margin 计算器纯函数自洽、28%/12% demo 数字被测试锁定;audit 脱敏(`redactSecrets`)在持久化前统一应用;路径遍历防护(run-id 白名单正则 + resolved-prefix 双检)标准;密钥卫生干净;`scanSearchPages` 的部分失败保数据设计;Easyship provider 本身质量很高(只是没被接上)。

## Verdict:Request Changes

**Demo 前必须修(按性价比排序):**
1. C4 Committee 页接真实数据 —— 不修 demo 高潮当场穿帮,半小时工作量
2. H11/studio 空 src 崩溃 —— 真实 run 后必触发,几行守卫
3. H2 margin 接 sourcing 真实产出 —— 评委盯着同屏矛盾的数字看
4. C2 一行接回 env shipping;C3 改诚实空结果(说明:demo 固定吸尘器时 C3 不触发,但任何自由输入环节都会)
5. H1 工具错误回喂 —— live 管道稳定性的最大单点

**公网部署前必须修:** H4(认证/限流)、H8(截图出 public)、H7(重定向复检)、C5(CORS/nginx 必选)。

**节奏允许再修:** H3、H6、H10、contract schema 补强、CI 加 typecheck+test。
