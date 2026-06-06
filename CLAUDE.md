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
3. **分两层交付,demo 不 live 调模型。**
   - **P0(必达):** `/api/run?mock=1` + 缓存,让整条 demo 主线端到端跑通、零延迟、零失败。
   - **P1(加分):** 真实 agent pipeline(`lib/agents/*`)。它**是 MVP 的一部分要做**,
     但**不是 demo 的主路径**——demo 默认走缓存,真实链路当展示/备份。

## Demo 高潮(所有取舍的判断标准)

> 用户选了 Mini Desk Vacuum → Risk Agent 当场弹「⚠ 夸大吸力 / 电器安全需人工复核」
> → 利润卡显示 base 28% 但 high-return 档掉到 12% → Committee 据此给 **Watch 不给 Go**。

服务这个高潮的东西优先做;不服务的一律砍进 roadmap。

## 技术栈

- **Next.js 14 (App Router) + TypeScript + Tailwind**,单仓单应用,Vercel 部署。
- **OpenAI**:Responses API + **Structured Outputs**(强制 JSON)+ **Function Calling**
  (查种子数据)。模型默认 `gpt-4o`。
- 6 个 agent = 6 次结构化调用串联,**不上重编排框架**。
- 状态全在一次 `/api/run` 返回里,前端无需复杂状态管理。

## 仓库结构

```
contract/            ← 前后端数据契约(已就位,先读 contract/README.md)
docs/                ← 架构 / 范围 / agent 规格 / 任务板 / PRD
app/                 ← Next.js(待建)
  api/run/route.ts   ← POST 接口,返回 RunResult;?mock=1 直回 mock
  (各页面路由)
components/          ← UI 组件
lib/
  openai.ts          ← OpenAI client
  agents/            ← 6 个 agent(market/sourcing/margin/risk/listing/committee)
seed/                ← 手抓的真实种子数据 + demo 预生成图
public/
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
4. 做完开 PR:`gh pr create`,标题带 `TASK-<n>`,正文写"对哪些 contract 字段负责"。
5. **绝不直接 push main**;main 永远保持可 demo。
   **唯一例外:TASK-01 骨架**——为快速解锁全队,允许直接 push main 一次。

> 还没建 Issues 时,先在 TASKS.md 里把自己名字写到任务后面占位。

## 写代码约定

- 严格 TypeScript,前端从 `contract/result.ts` import 类型,不自己重定义。
- agent 的输入/输出 schema 见 [docs/AGENTS.md](docs/AGENTS.md),必须和 contract 对齐。
- 提交信息带任务号,例如 `TASK-03: opportunity board profit card`。
