# Demo 就绪报告 — Phase 9 Hardening

> 2026-06-07 实测。对应 IMPLEMENTATION-ROADMAP §12 Phase 9 + NEXT-STEPS.md GAP-2/GAP-3。

## 1. 彩排结果(live,无任何 mock)

| # | 模式 | HTTP | 耗时 | primary 决策 |
|---|---|---|---|---|
| 预验证 | `?images=0` | 200 | 190s | Watch |
| GAP-2 | **全量(live 图像)** | 200 | 225s | Watch |
| run1 | `?images=0` | 200 | 199s | Watch |
| run2 | `?images=0` | 200 | 227s | Watch |
| run3 | `?images=0` | 200 | 200s | Watch |
| run4 | `?images=0` | 200 | **355s** | Watch |
| run5 | `?images=0` | 200 | 210s | Watch |

**成功率 7/7(100%)** · 文本管道中位 ~210s · 长尾 355s(OpenAI 偶发慢,run4 sourcing 阶段) ·
全量含图约 +30s。

## 2. Demo 高潮校验(每次都复现)

- primary(Mini Desk Vacuum)= **Watch**,不给 Go ✅
- margin base ≈33% / low ≈17%(< 25% 目标 → 触发敏感警告)✅
- risk:`medium` + `human_review_required` + **三条红线 warning**
  (利润敏感 / USB·电器安全人工复核 / 避免夸大吸力)✅(GAP-5 修复后)
- committee tradeoffs ×3(devil's advocate)+ ranked_ids 排序稳定 ✅
- 全量模式:3 张图(hero/lifestyle/feature)落 `public/generated/<run_id>/`,
  compliance 标 `needs_review` ✅

## 3. Audit 样本

- 成功样本:`.runs/run_full-1780838533/`(全量含图)、`.runs/run_rehearsal-1-1780838860/`
  (本地保留,gitignore 不入库;demo 机器上请勿清理 `.runs/`)。
- 降级样本:committee LLM 失败兜底由单测覆盖(`lib/agents/committee/__tests__/agent.test.ts`
  超时/不完整输出/三处降级可见性),无需真实断网捕获。

## 4. Demo 当天 checklist

1. `npm run dev` 起服务后**先跑一次 `?images=0` 预热**(排除冷启动/网络抖动,且确认 key 有效)。
2. 演示路径:`/app/brief` 填表 → org-room 看**渐进点亮**(audit 轮询,3s 刷新)→ board → studio → listing。
3. 时长预期:文本 ~3.5 分钟,全量 ~4 分钟;**演示用 `?images=0` 起跑,图像提前用全量 run 生成好展示**。
4. 长尾风险:见过 1 次 355s;若超 5 分钟,口播切换到已生成的 audit/截图(录屏兜底**待人工录制**)。
5. 网络兜底:提前录一遍完整 happy path 屏幕录像(此项无法自动化,需人工完成 ⬜)。

## 5. 残余事项

- ⬜ 录屏(人工)
- ⬜ Vercel 部署(需 Pro 套餐 + KV audit sink,见 NEXT-STEPS.md GAP-7;demo 可本地跑)
- P2:pickup 断电恢复、pure-A 软约束 eval、Oxylabs 1688 live 数据源
