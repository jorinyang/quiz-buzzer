# Quiz Buzzer - 题目抢答工具

## 环境变量

复制 `.env.example` 到 `.env.local` 并填入配置值。

```bash
cp .env.example .env.local
```

## 快速开始

```bash
# 安装依赖
pnpm install

# 初始化数据库（首次）
pnpm db:push
pnpm db:seed

# 启动 WebSocket 服务
pnpm ws:dev

# 启动所有前端（新终端）
pnpm dev
```

## 项目结构

```
apps/
├── display/     # 大屏展示端 (port 3000)
├── admin/       # 后台控制端 (port 3001)
└── player/      # 选手/评委端 (port 3002)
packages/
└── shared/      # 共享类型 + Hooks + 组件
ws-server/       # WebSocket 实时服务 (port 3080)
supabase/        # 数据库 Schema + 种子数据
```
