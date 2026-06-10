# 部署 — 云服务器(Docker)

> 目标环境:任意一台 Docker 化云服务器(2C4G 起步即可,管道是 IO/API 密集非算力密集)。
> 不用 Vercel:管道单次 200-360s,长驻 Node 进程没有函数超时问题;`.runs/` 与
> `public/generated/` 直接落盘(compose volume 持久化),无需 KV 改造。
>
> **两个应用**:`api`(仓库根 Next 应用,只有 `/api/*`,无页面路由)+ `frontend`
> (`frontend/` 下独立 Next 16 应用,营销页 + `/app` 工作台)。

## 1. 一次性准备

```bash
# 服务器上
git clone https://github.com/jason524w/hackton-shopee.git && cd hackton-shopee
cp .env.example .env.local        # 填 OPENAI_API_KEY(必填),其余可保持默认
```

## 2. 启动

```bash
docker compose up -d --build
# api      → http://<server>:3000   (POST /api/run, GET /api/runs/:id/audit, /generated/*)
# frontend → http://<server>:3001   (营销页 + /app 工作台)
```

`NEXT_PUBLIC_API_BASE_URL` **默认留空(同源)**,配合 §3 nginx 使用。这是推荐路径。

## 3. nginx 反代(同域名收敛,**推荐 / 默认**)

把两个应用收敛到 **同一个 origin**,前端用相对路径 `/api`、`/generated` 请求,
**完全避开 CORS**,且 build 时不需要把任何后端地址烧进客户端 bundle。

```nginx
server {
  server_name demo.example.com;
  # 管道最长见过 360s,代理超时给足
  proxy_read_timeout 600s;
  proxy_send_timeout 600s;

  # API 与 live 生成图都由 api 容器(:3000)提供;必须把这两条都代到 api,
  # 否则 /generated/*(生成的商品图)会 404,studio/board 的图全空。
  location /api/        { proxy_pass http://127.0.0.1:3000; }
  location /generated/  { proxy_pass http://127.0.0.1:3000; }

  # 其余(页面 + 静态资源)走 frontend 容器(:3001)
  location /            { proxy_pass http://127.0.0.1:3001; }
}
```

同域部署时 `NEXT_PUBLIC_API_BASE_URL` 留空即可(前端默认同源请求);
build 不需要任何 `--build-arg`。

## 3b. 拆端口(无 nginx,**仅本地/调试**)

不推荐用于真实部署。前端 :3001 直接跨源打 api :3000 时:

1. **API 必须开 CORS**:在 `.env.local` 设 `ALLOWED_ORIGIN=http://<server>:3001`
   (api 侧的 CORS middleware 据此放行 preflight)。否则浏览器直接拦截 POST。
2. **build 时注入可达的 API 地址**(不能是裸 localhost,远程部署时那是访问者自己的机器):

   ```bash
   NEXT_PUBLIC_API_BASE_URL=http://<server>:3000 docker compose up -d --build
   ```

3. **生成图跨源**:`/generated/*` 由 api 容器提供,前端拿到绝对 URL 后,
   `next.config.ts` 会按 `NEXT_PUBLIC_API_BASE_URL` 自动把该 origin 的
   `/generated/**` 加入 `images.remotePatterns`(已实现)。仍需确认该端口公网可达。

> 结论:能上 nginx 就上 §3,省掉 CORS / 跨源生成图两类坑。

## 4. 验证清单

```bash
curl -s -X POST 'http://<server>:3000/api/run?images=0' -d '{}' \
  -H 'content-type: application/json' | head -c 200   # 200 + RunResult(约 3-4 分钟)
# 没配 key 时应返回 503 not_configured(单一真实路径,无兜底)
```

浏览器走一遍:`/app/brief` 提交 → org-room 渐进点亮 → board → studio → listing。
同时确认 studio/board 的商品图能加载(验证 `/generated/` 代理正确)。

## 5. 运维要点

- **更新**:`git pull && docker compose up -d --build`(main 永远可部署,CI 过即可)。
- **持久化**:audit 在 volume `runs-data`,生成图在 `generated-images`;`docker compose down -v` 会清掉,慎用。
- **健康检查**:api 没有页面路由,`/` 返回 404 是正常的;compose healthcheck 把
  「端口能应答 HTTP(含 404/503)」判为 healthy,server 真宕了才 unhealthy。
- **日志**:`docker compose logs -f api`。
- **资源**:镜像基于 node:22-alpine,standalone 输出,单镜像 ~200MB;并发 demo 足够,
  注意 OpenAI 限流才是瓶颈(同时只跑一条管道最稳)。
