# CLAUDE.md — Sea Launch AI

> 给在本仓库工作的任何 Claude Code agent / 队员看的第一份文档。
> 多台电脑、多个 agent 协作,**先读这里,再动手**。

## 这是什么

**Sea Launch AI** — Sea × OpenAI Codex Hackathon 参赛项目(电商赛道)。

一句话:面向轻资产卖家的 AI-native 电商运营系统。卖家给出商品方向,multi-agent
团队在几分钟内产出一份 **Shopee-ready 的商业判断 + 上架包**:市场→货源→利润→风险→上架→决策。

赛道方向:**AI-Native Products & Operations**。差异点不是"给电商加聊天框",而是
**在生成文案之前,先自动完成 profit-aware 的商业决策**。

完整产品背景见 [PRD](docs/PRD.md)。**本仓库只交付 24h MVP**,范围见下。

## 🔒 三条铁律(任何改动都不能违反)

1. **Contract-first。** `contract/` 是前后端唯一对齐目标。前端对着
   `contract/mock-result.json` 开发,后端 `/api/run` 的输出必须能通过
   `contract/result.schema.json` 校验。**改 contract = 改 3 个文件并通知全队**
   (`mock-result.json` + `result.ts` + `result.schema.json`)。
2. **MVP 范围内才动手。** 只做 [docs/MVP-SCOPE.md](docs/MVP-SCOPE.md) 里"✅ 做"的部分。
   想加功能 → 先问"它服务 demo 高潮吗?"(见下)。不服务就不做。
3. **Live 是主 demo 路径,mock 是永不可移除的安全网。**
   - **主路径:** `/api/run` 真实 7-agent pipeline(含 live 图像生成),见 [IMPLEMENTATION-ROADMAP](docs/IMPLEMENTATION-ROADMAP.md)。
   - **安全网(必达、一键可切):** `/api/run?mock=1` + 缓存,零延迟零失败,live 卡顿/失败随时切回。
   - **`/api/run?images=0`** 跑纯文本快速彩排。**永远不要移除 `?mock=1`**;demo 当天先验安全网再跑 live。

## Demo 高潮(所有取舍的判断标准)

> 用户选了 Mini Desk Vacuum → Risk Agent 当场弹「⚠ 夸大吸力 / 电器安全需人工复核」
> → 利润卡显示 base 28% 但 high-return 档掉到 12% → Committee 据此给 **Watch 不给 Go**。

服务这个高潮的东西优先做;不服务的一律砍进 roadmap。

## 技术栈

- **Next.js 14 (App Router) + TypeScript + Tailwind**,单仓单应用,Vercel 部署。
- **OpenAI**:Responses API + **Structured Outputs**(强制 JSON)+ **Function Calling**
  (查种子数据)。模型默认 `gpt-4o`。
- **7 个 agent** + ReAct runtime + provider 适配层 + audit(完整后端,见 [IMPLEMENTATION-ROADMAP](docs/IMPLEMENTATION-ROADMAP.md))。
- 状态全在一次 `/api/run` 返回里(`RunResult`),前端无需复杂状态管理;audit 走 `audit_run_id`。

## 仓库结构

```
contract/            ← 前后端数据契约(已就位,先读 contract/README.md)
docs/                ← 架构 / ROADMAP / COMMITTEE / 范围 / 任务板 / PRD
app/
  api/run/route.ts   ← POST,返回 RunResult;?mock=1 / ?images=0 / live
  api/runs/[id]/audit/route.ts
  (brief / war-room / board / studio 页面路由)
components/          ← UI 组件
lib/
  openai.ts          ← OpenAI client
  agent-runtime/     ← ReAct loop + tool-runner + audit + replay
  providers/         ← shopee / sourcing-1688 / shipping / fx / openai-image 适配器
  agents/            ← 7 个 agent(market/sourcing/margin/risk/listing/packaging/committee),各目录化
seed/                ← 手抓的真实种子数据(market/sourcing/rules/shipping/fx/images)
public/generated/    ← live 生成的商品图(不入库)
```

## 怎么跑

```bash
npm install
cp .env.example .env.local   # 填 OPENAI_API_KEY
npm run dev                  # http://localhost:3000
```
> 骨架还没建时,以上命令尚不可用;建骨架是 [TASK-01](docs/TASKS.md)。

## 多电脑 / 多 agent 任务领取流程

任务板在 [docs/TASKS.md](docs/TASKS.md)。**用 GitHub Issues 做认领**(避免多机改同一个 md 冲突):

1. `gh issue list` 看未认领任务。
2. 领一个:`gh issue edit <n> --add-assignee @me`,并把它移到 in-progress。
3. **每个任务开独立分支**:`git checkout -b task-<n>-<slug>`。
4. 做完开 PR:`gh pr create`,标题带 `TASK-<n>`,正文**必须写 `Closes #<issue 号>`**(merge 后自动关 issue,避免做完了 issue 还挂着)+ "对哪些 contract 字段负责"。
5. **绝不直接 push main,一切走 PR**(含 TASK-01 骨架);main 永远保持可 demo。
   不强制 review:**PR + CI 绿 → 自己 merge**。详见 [CONTRIBUTING.md](CONTRIBUTING.md)。

> 还没建 Issues 时,先在 TASKS.md 里把自己名字写到任务后面占位。

## 写代码约定

- 严格 TypeScript,前端从 `contract/result.ts` import 类型,不自己重定义。
- agent 的输入/输出 schema 见 [docs/AGENTS.md](docs/AGENTS.md),必须和 contract 对齐。
- 提交信息带任务号,例如 `TASK-03: opportunity board profit card`。
