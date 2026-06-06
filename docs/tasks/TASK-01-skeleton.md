# TASK-01 · Next.js 骨架(blocking)

> **唯一的串行卡点。** 一个人立刻做、~20–30 分钟、**直接 push main**,其余轨才解锁。
> 谁先配好环境谁做(建议前端同学,因为前端最依赖它)。

## 目标
搭起可运行的 Next.js 应用,让前端有路由可渲染、后端有地方挂 `/api/run`。

## 独占路径(本任务一次性建好,之后各轨各占自己目录)
`package.json` `tsconfig.json` `tailwind.config.*` `next.config.*` `app/layout.tsx`
`app/page.tsx` `lib/openai.ts` `.env.example`(已存在,核对即可)

## 内容
- Next.js 14 (App Router) + TypeScript + Tailwind。
- 4 个空路由占位:`app/brief` `app/war-room` `app/board` `app/studio`(各一个 `page.tsx` 写个标题即可)。
- `lib/openai.ts`:导出配置好的 OpenAI client(读 `OPENAI_API_KEY`)。
- `app/api/run/route.ts`:`POST` 先实现 `?mock=1` → 返回 `contract/mock-result.json`。
- 根 `app/page.tsx`:跳到 `/brief`。

## 验收
- `npm install && npm run dev` 起得来。
- 访问 `/brief /war-room /board /studio` 四个路由都不报错。
- `curl -X POST 'localhost:3000/api/run?mock=1'` 返回完整 `RunResult` JSON。

## 完成后
直接 push main,并在群里 / issue 里吼一声"骨架已上",解锁前端 / 后端轨。
