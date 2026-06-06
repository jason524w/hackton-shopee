# TASK-14 设计 · Committee(纯-A:LLM 定 verdict)

> [#14](https://github.com/jason524w/hackton-shopee/issues/14) 的实现设计。
> **⚠️ 本文有意偏离 [COMMITTEE.md](../COMMITTEE.md) §1「LLM 不碰最终决策」** —— 经用户拍板,committee 改用
> **纯 LLM 定 Go/Watch/Reject(亮点)**;确定性层降级为"证据 + 失败兜底"。COMMITTEE.md 的 Gate 清单/contract 映射仍是参考。
> 配套:[contracts.ts](../../lib/agents/contracts.ts)(seam)、[run-agent.ts](../../lib/agent-runtime/run-agent.ts)(`runAgent`/audit/replay)、[margin-risk.md §5.5](margin-risk.md)。

## 0. 决策基线(用户确认)

- **verdict 由 LLM 定**(纯 A),不加"钳住成功输出"的护栏。**暂不考虑 live 翻车** —— 真正的 demo 安全网是 `?mock=1`(铁律 #3,未动)。
- 确定性 `overall` 分 + gate flags **保留**,只当**证据**喂 LLM + 给前端,不再定 verdict。
- `human_review_required` **不当决策 gate**(流程标志,合规已在 `compliance` 分里);只作证据 + Studio 警告。
- LLM 失败 → 退回确定性 `baseDecision`,**且把降级输出出来**;支持**断电 pickup**(audit/replay)。

## 1. 形态:committee 是 LLM agent

```ts
import type { Agent } from "../contracts";
export const committeeAgent: Agent = async (ctx) => {
  const opps = ctx.results.opportunities ?? [];
  const evidence = buildEvidence(opps, ctx);            // 确定性:overall + flags + risk warnings
  const snapshot = await ctx.audit?.getAgentSnapshot(ctx.runId, "committee"); // 断电 pickup
  const decision = snapshot?.status === "completed"
    ? replayOutputFromSnapshot(snapshot)                // 复用,不重调 LLM
    : await runCommitteeLLM(evidence, ctx);             // runAgent(skill, evidence, schema, mode)
  return decision.ok
    ? mapToSlice(decision.output, opps)                 // LLM verdict → opportunities + committee
    : mapToSlice(fallbackDecision(evidence), opps, { degraded: decision.error });
};
```

- 用 runtime 的 `runAgent({ skill, input: evidence, outputSchema, mode, audit, runId, timeoutMs, retryOnce: true })`。
- `mode`:`fixture`(测试/dry-run,喂确定性 stub)/ `live`(真调 LLM)/ `mock`(走不到这,API 层 ?mock=1 静态透传)。
- ⚠️ **裸 `committeeAgent` 默认 `fixture`(不调 LLM)。#15 要真跑 LLM 必须显式 `runCommitteeAgent(ctx, { mode: "live" })`**(与 #11 market/sourcing 同约定)。否则 PR 标题的 "LLM 定 verdict" 不会发生。(review finding #5)
- **完整性校验**:LLM 返回后必须经 `isComplete()` —— `decisions` + `ranked_ids` 恰好覆盖全部 opportunity id;不满足 → 当作失败,退回确定性兜底(不静默保留旧 decision)。这是**结构校验,不是 verdict 护栏**(不覆盖 Go/Watch/Reject)。(review finding #3a)
- `ctx.audit`/`ctx.runId` 当前不在 `AgentContext` 上 —— 见 §5 范围分工(由 #15 注入或经 providers 传)。

## 2. 确定性证据层(保留,只喂 LLM,不定词)

`buildEvidence` 逐候选组装结构化证据,给 LLM 信号、给前端显示:

```
overall          = Σ(scores[k]*weights[k])  四舍五入   // 写回 o.scores.overall
margin_signal    = primary 才有:low.net_margin vs brief.target_margin
fulfillment_gap  = o.fulfillment_days − brief.max_fulfillment_days
risk_signal      = o.risk_level + 风险 warnings
hard_flags       = ctx.risk.getCheckpoints() 的 hard_block / images rejected / stock out
```

> ⚠️ **风险 warnings 取源(review finding #2):** committee 在 pipeline 里跑在 **risk 聚合之前**,
> 所以**不能**读 `ctx.results.agents[risk].warnings`(那时还不存在)。改读
> `ctx.risk.getCheckpoints().flatMap(c=>c.warnings)` + `selected_listing.compliance.warnings`(均已就绪),去重。

> 权重固定 `{profit:.30, demand:.25, compliance:.20, fulfillment:.15, packaging:.10}`,由 #14 写入 `committee.weights`。
> `human_review` 进 `risk_signal` 当证据,**不是 gate**。

## 3. LLM 委员会(verdict + 排序 + 反证 + summary)

- **AgentSkill**:CEO/投委会 persona。指令:逐候选基于证据判 **Go/Watch/Reject**、给 `ranked_ids`、≥3 条可证伪反证、`summary`、每个 `decision_reason`(必须自然带出**利润敏感** + **合规/人工复核**,满足 roadmap §8.7 验收)。
- **Structured Output schema**:强制 JSON —— `{ decisions: [{id, verdict, decision_reason, key_reasons}], ranked_ids, tradeoffs[], summary }`。
- LLM **同时定词 + 写理由**(纯 A 的亮点)。

## 4. 失败兜底(必须可见)

LLM 超时/断网(`runAgent` 已含 timeout + 1 retry)→ `ok:false` → 退回确定性 `fallbackDecision(evidence)`:

```
overall>=70?Go:overall>=50?Watch:Reject               // baseDecision
+ 硬底线兜底(复用 gates 逻辑,reject 不被钳为升级):
    risk_level=high / hard_block / images rejected / stock out  → Reject
    margin.low<target(primary)/ fulfillment>max / missing_fields → 封顶 Watch
```

> 兜底复现 demo:吸尘器 Watch、dehumidifier Reject、cable Go。**这就是原来确定性 gate 的逻辑,没浪费 —— 只是从"主决策"降为"fallback"。**

**降级必须输出出来**(用户要求),三处:
- `committee` AgentResult(`agents[]` key=committee)`.warnings += "⚠ LLM 委员会降级:确定性兜底(<error code>)"`,`status` 仍 `done`。
- `committee.summary` 前缀模板:`(LLM 暂不可用,以下为确定性兜底决策)…`。
- 受影响 `decision_reason` 用确定性模板(仍引用 gate hits + risk warnings)。

## 5. 断电 pickup(用现有 audit/replay)

- committee 的 LLM 调用经 `audit` sink 记录(`startAgent`→`recordModelResponse`→`completeAgent`,落 `.runs/<audit_run_id>/`)。
- 重跑同 `audit_run_id`:`getAgentSnapshot(runId,"committee")` 命中 completed 快照 → `replayOutputFromSnapshot` **复用 verdict,不重调 LLM**(省钱 + 不丢已得结果)。
- **范围分工**:#14 实现 check-snapshot-before-call + replay;**恢复入口(检测半截 run、重发同 run_id)+ 文件型 AuditSink 持久化属 #15**。#14 只对 `AuditSink` 接口编程,内存/文件由 #15 注入。
  - 注:`AgentContext` 现无 `audit`/`runId` 字段。MVP 可先经 `providers` 或 #15 包一层把 sink 传进来;若需要扩 `AgentContext` 则走"改 seam = 通知全队"(#23 owner)。

## 6. 模块结构 + TDD 顺序

```
lib/agents/committee/
  weights.ts    ← overall 加权(证据 + 兜底 + UI)             【纯函数,单测】
  gates.ts      ← fallbackDecision:baseDecision + 硬底线兜底  【纯函数,单测,覆盖三候选】
  evidence.ts   ← buildEvidence 逐候选证据组装               【纯函数,单测】
  skill.ts      ← AgentSkill persona + 指令
  schema.ts     ← Structured Output JSON schema
  index.ts      ← committeeAgent:证据→runAgent→(失败)兜底+降级输出→映射 slice;pickup
  __tests__/    ← weights/gates/evidence 纯单测;index 用 mode:"fixture" 测装配 + 失败兜底 + replay 复用
```

**TDD 顺序:** `weights` → `gates`(三候选边界)→ `evidence` → `index`(fixture 装配 / 失败降级 / pickup 复用)→ `skill`+`schema` 配 live。

## 7. 验收锚点

- **live(fixture 模式代演)**:LLM 输出经 schema 校验,映射出过 `check-contract` 的 RunResult。
- **fallback**:断网 → 确定性兜底,吸尘器=Watch、dehumidifier=Reject、cable=Go;降级在 warnings/summary/reason 三处可见。
- **pickup**:同 run_id 二次运行,committee 命中快照 → 不重调 LLM,verdict 一致。
- `decision_reason` 提利润敏感 + 合规/人工复核;排序 Go>Watch>Reject(cable>vacuum>dehumidifier)。
- **「高风险/硬违规不能 Go」是软约束(pure-A)**:由 skill 硬指令 + eval 监测保障,**非代码硬闸**(用户决定,见 [[committee-pure-llm-verdict]])。
  代码只做结构兜底:LLM 失败/输出不完整 → 确定性兜底(它复现高风险=Reject)。若 eval 显示模型不够稳,再考虑加最小护栏。
- **建议补一个红线 eval 集**(假冒品牌/违禁/high-risk → 断言 Reject 通过率)纳入 #16 QA —— 这是"靠 agent 不靠代码"路线的监测手段。
- 不改 contract。
