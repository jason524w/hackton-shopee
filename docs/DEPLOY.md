# 部署 — 云服务器(Docker)

> 目标环境:任意一台 Docker 化云服务器(2C4G 起步即可,管道是 IO/API 密集非算力密集)。
> 不用 Vercel:管道单次 200-360s,长驻 Node 进程没有函数超时问题;`.runs/` 与
> `public/generated/` 直接落盘(compose volume 持久化),无需 KV 改造。

## 1. 一次性准备

```bash
# 服务器上
git clone https://github.com/jason524w/hackton-shopee.git && cd hackton-shopee
cp .env.example .env.local        # 填 OPENAI_API_KEY(必填),其余可保持默认
```

## 2. 启动

```bash
docker compose up -d --build
# api      → http://<server>:3000   (POST /api/run, GET /api/runs/:id/audit)
# frontend → http://<server>:3001   (营销页 + /app 工作台)
```

前端构建时注入 API 地址(浏览器端轮询要用公网可达的 URL):

```bash
NEXT_PUBLIC_API_BASE_URL=https://demo.example.com docker compose up -d --build
```

## 3. nginx 反代(同域名收敛,推荐)

```nginx
server {
  server_name demo.example.com;
  # 管道最长见过 360s,代理超时给足
  proxy_read_timeout 600s;
  proxy_send_timeout 600s;

  location /api/  { proxy_pass http://127.0.0.1:3000; }
  location /generated/ { proxy_pass http://127.0.0.1:3000; }
  location /      { proxy_pass http://127.0.0.1:3001; }
}
```

同域部署时 `NEXT_PUBLIC_API_BASE_URL` 留空即可(前端默认同源请求)。

## 4. 验证清单

```bash
curl -s -X POST 'http://<server>:3000/api/run?images=0' -d '{}' \
  -H 'content-type: application/json' | head -c 200   # 200 + RunResult(约 3-4 分钟)
# 没配 key 时应返回 503 not_configured(单一真实路径,无兜底)
```

浏览器走一遍:`/app/brief` 提交 → org-room 渐进点亮 → board → studio → listing。

## 5. 运维要点

- **更新**:`git pull && docker compose up -d --build`(main 永远可部署,CI 过即可)。
- **持久化**:audit 在 volume `runs-data`,生成图在 `generated-images`;`docker compose down -v` 会清掉,慎用。
- **日志**:`docker compose logs -f api`。
- **资源**:镜像基于 node:22-alpine,standalone 输出,单镜像 ~200MB;并发 demo 足够,
  注意 OpenAI 限流才是瓶颈(同时只跑一条管道最稳)。
