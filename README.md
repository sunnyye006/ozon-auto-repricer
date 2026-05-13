# Ozon 自动跟卖调价工具（FastAPI + React + Supabase）

这是一个围绕 Ozon 平台的自动跟卖调价系统骨架，满足你提出的核心要求：

- 多店铺绑定与集中管理
- 全量商品同步与成本价管理（含批量导入）
- 自动扫描跟卖并执行调价（支持 5/10/20 分钟和自定义）
- 对手退出后恢复本轮调价前原价
- 触及成本价立即止损
- 实时调价事件流（SSE）

---

## 1) 技术方案总览

### 架构

- 前端：`React + Vite + TypeScript`
- 后端：`FastAPI + APScheduler + SQLAlchemy Async`
- 数据库：`Supabase Postgres`
- 通信：
  - 管理类接口：REST API
  - 实时调价事件：Server-Sent Events（`/api/events/stream`）

### 核心执行链路

1. 绑定店铺（存储加密后的 API Key）
2. 拉取 Ozon 商品并写入本地 `products`
3. 定时任务按设置频率执行（5/10/20 分钟或自定义）：
   - 拉取每个商品的跟卖报价列表
   - 调价引擎计算目标价格（步长 0.1）
   - 通过 Ozon API 执行改价
   - 写入事件并推送到实时流

---

## 2) 功能映射到你的需求

### 2.1 面板仪表盘

- `GET /api/dashboard/stats` 输出：
  - 商品总数 `total_products`
  - 抢占最优价占比 `top_price_capture_ratio`
  - 已参与调价商品数 `repricing_product_count`
  - 竞争对手数量 `competitor_count`
- 前端 `StatsCards` 组件可视化展示

### 2.2 商品与成本管理

- 通过 `POST /api/stores/{id}/sync-products` 触发 Ozon 商品同步
- 每个商品可单独维护 `cost_price`
- 支持：
  - 批量 JSON 更新：`PUT /api/products/costs`
  - CSV 导入：`POST /api/products/costs/import`

### 2.3 跟卖识别与自动竞价

- 定时任务：`APScheduler interval=10 minutes`
- 规则实现：`PricingEngine.process_product`
  - 若存在竞争者且其价格高于我方：我方价格 `-0.1`
  - 只要仍满足上述条件，下一轮继续降 `0.1`
  - 若降到成本价：立刻止损并保持成本价
- 恢复逻辑：
  - 若跟卖列表为空，且处于本轮调价状态：恢复 `round_original_price`

### 2.4 技术实现要求

- 所有价格调整统一经 `OzonClient.update_price()` 发起（后端 `RepricerRunner`）
- 监测与触发完全由系统内部实现（无外部规则引擎）
- 实时事件流输出字段：
  - 平台、店铺、商品、方向（↑/↓）、时间戳

---

## 3) 核心代码结构

```text
.
├── backend
│   ├── app
│   │   ├── api/routes
│   │   │   ├── dashboard.py
│   │   │   ├── events.py
│   │   │   ├── products.py
│   │   │   └── stores.py
│   │   ├── core
│   │   │   ├── config.py
│   │   │   ├── db.py
│   │   │   └── security.py
│   │   ├── services
│   │   │   ├── ozon_client.py
│   │   │   ├── pricing_engine.py
│   │   │   └── repricer_runner.py
│   │   ├── events.py
│   │   ├── main.py
│   │   ├── models.py
│   │   └── schemas.py
│   └── requirements.txt
├── frontend
│   ├── src
│   │   ├── api/client.ts
│   │   ├── components
│   │   │   ├── EventStream.tsx
│   │   │   ├── ProductTable.tsx
│   │   │   ├── StatsCards.tsx
│   │   │   └── StoreManager.tsx
│   │   ├── types/index.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   └── package.json
└── sql/schema.sql
```

---

## 4) 关键模块实现逻辑

### A. 调价状态机（`pricing_engine.py`）

- 维护 `repricing_states`：
  - `in_round`：是否处于当前跟卖调价轮次
  - `round_original_price`：本轮调价前原价（用于恢复）
  - `floor_reached`：是否触发成本止损
  - `competitor_count`：本轮扫描竞争者数量

执行逻辑：

1. 无竞争者：
   - 若 `in_round=true`：恢复 `round_original_price`，发 ↑ 事件；
   - 否则不改价。
2. 有竞争者：
   - 首次进入轮次时记录 `round_original_price`。
   - 若 `max(competitor_price) > my_price`：`my_price -= 0.1`
   - 若新价 <= 成本价：钉住成本价并停止继续下探。

### B. 定时扫描执行器（`repricer_runner.py`）

- 拉取所有激活店铺与商品
- 为每个商品读取 Ozon 跟卖报价
- 调用调价引擎得到目标价
- 若有变更，调用 Ozon API 更新价格（强制走官方 API）
- 事务提交事件和状态更新

### C. 事件流（`events.py` + `events/stream`）

- 内存队列发布订阅
- 每次价格变化写 `price_events`，同时推送 SSE
- 前端通过 `EventSource` 实时渲染

### D. 多店铺密钥管理（`security.py`）

- API Key 使用 `Fernet` 对称加密后入库
- 运行时解密用于 Ozon API 调用
- 建议生产中将 `APP_SECRET_KEY` 放入安全密钥系统（如 Supabase Vault/Secret Manager）

---

## 5) Supabase Postgres 设计

见 `sql/schema.sql`，核心表：

- `stores`：店铺 API 凭据与基础信息
- `products`：商品、当前价、成本价、自动调价开关
- `repricing_states`：每个商品的调价轮次状态
- `price_events`：完整调价审计与实时事件来源

---

## 6) 部署说明

## 6.1 后端（FastAPI）

1. 进入后端目录：
   - `cd backend`
2. 安装依赖：
   - `python -m venv .venv && source .venv/bin/activate`
   - `pip install -r requirements.txt`
   - 说明：项目默认使用 `psycopg` 驱动，兼容 Python 3.14。
3. 配置环境变量：
   - 复制 `.env.example` 为 `.env`
   - `DATABASE_URL` 可不填（默认本地 sqlite：`sqlite+aiosqlite:///./data/ozon_local.db`）
   - 若接入 Supabase，推荐 `postgresql+psycopg://...`；若仍是 `postgresql+asyncpg://...` 也会在启动时自动转换。
4. 启动服务：
   - `uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload`

### 一键本地启动（推荐）

在项目根目录执行：

- `./run_backend_local.sh`

## 6.2 前端（React）

1. 进入前端目录：
   - `cd frontend`
2. 安装依赖：
   - `npm install`
3. 配置 API 地址：
   - 复制 `.env.example` 为 `.env`
4. 启动前端：
   - `npm run dev`

---

## 7) 生产化建议（下一步）

- 对 Ozon API 接口增加：
  - 重试（指数退避）
  - 限流与熔断
  - 签名/鉴权错误分类告警
- 将调价扫描拆为队列并发任务（按店铺分片）
- 引入行级锁/乐观锁避免并发写价冲突
- 对事件流增加持久化 offset 和 WebSocket 网关（高并发前端）
- 增加权限系统与操作审计（多运营团队场景）

---

## 8) 接口说明（最小集）

- 店铺：
  - `GET /api/stores`
  - `POST /api/stores`
  - `POST /api/stores/{store_id}/sync-products`
- 商品：
  - `GET /api/products`
  - `PUT /api/products/costs`
  - `POST /api/products/costs/import`
- 仪表盘：
  - `GET /api/dashboard/stats`
  - `GET /api/dashboard/events`
  - `POST /api/dashboard/scan-now`
- 实时流：
  - `GET /api/events/stream`
- 设置：
  - `GET /api/settings`
  - `PUT /api/settings/scan-interval`
