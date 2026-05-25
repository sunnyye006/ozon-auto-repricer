# Ozon 自动调价上线指南（Supabase + Railway + Vercel）

## 1. Supabase（数据库）

1. 在 Supabase 创建项目，拿到连接串（Transaction pooler 或 direct 均可）。
2. 将 `DATABASE_URL` 设为：

```bash
postgresql+psycopg://postgres:<password>@<host>:5432/postgres
```

3. 首次启动后端时会自动 `create_all` 建表，无需手工迁移。

建议把以下变量也放入 Railway：

- `APP_ENV=prod`
- `APP_SECRET_KEY=<32+位随机字符串>`
- `DATABASE_URL=<supabase_url>`
- `OZON_API_BASE_URL=https://api-seller.ozon.ru`

## 2. Railway（FastAPI 后端）

仓库已包含 `backend/Dockerfile` + `railway.json`，可直接部署。

```bash
railway login
railway init
railway up
```

部署后记录后端公网地址，例如：

- `https://ozon-repricer-api-production.up.railway.app`

## 3. Vercel（React 前端）

仓库已包含 `vercel.json`，前端目录为 `frontend`。

```bash
vercel login
vercel --prod
```

在 Vercel 项目环境变量中设置：

- `VITE_API_BASE=https://<你的Railway域名>/api`

## 4. 联通校验（上线后）

1. 打开 `https://<railway-domain>/healthz` 应返回 `{"ok": true}`。
2. 打开前端页面，右上角设置中保存一次“扫描频率”和“自动调价规则”。
3. 后端日志应出现定时扫描执行记录（并可看到事件流更新）。
