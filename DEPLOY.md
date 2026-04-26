# Familiar 部署指南

## 前置要求

- 服务器已安装 Docker 和 Docker Compose
- 服务器已安装 Git
- 服务器开放 8080 端口（安全组/防火墙）

## 环境变量

项目运行需要以下环境变量，以 `.env` 文件形式放在项目根目录：

| 变量名 | 必填 | 说明 |
|---|---|---|
| `VITE_SUPABASE_URL` | 是 | Supabase 项目 URL（构建时注入前端） |
| `VITE_SUPABASE_ANON_KEY` | 是 | Supabase 匿名密钥（构建时注入前端） |
| `SUPABASE_SERVICE_ROLE_KEY` | 否 | Supabase Service Role 密钥（后端 API 代理使用） |
| `MODEL_CHAT_API_URL` | 否 | AI 对话模型 API 地址 |
| `MODEL_CHAT_API_KEY` | 否 | AI 对话模型 API 密钥 |
| `VIDEO_PARSER_AK` | 否 | 视频解析服务 Access Key |

> `VITE_` 前缀的变量会在 Docker 构建阶段通过 build args 注入到前端代码中，因此**修改这些变量后需要重新构建镜像**。

## 手动部署步骤

### 1. SSH 登录服务器

```bash
ssh <用户名>@<服务器IP>
# 输入服务器密码（向项目负责人获取）
```

### 2. 拉取代码

首次部署：

```bash
cd /opt
git clone <仓库地址> Familiar
cd Familiar
```

后续更新：

```bash
cd /opt/Familiar
git pull origin main
```

### 3. 配置环境变量

```bash
cat > /opt/Familiar/.env << 'EOF'
VITE_SUPABASE_URL=<你的Supabase URL>
VITE_SUPABASE_ANON_KEY=<你的Supabase Anon Key>
SUPABASE_SERVICE_ROLE_KEY=<你的Service Role Key>
MODEL_CHAT_API_URL=<AI模型API地址>
MODEL_CHAT_API_KEY=<AI模型API密钥>
VIDEO_PARSER_AK=<视频解析AK>
EOF
```

### 4. 构建并启动

```bash
cd /opt/Familiar
docker compose up --build -d
```

构建过程说明：
- **阶段 1（build）**：基于 `node:20-alpine`，执行 `npm ci` 安装依赖，然后 `npm run build`（TypeScript 编译 + Vite 打包），构建时通过 build args 注入 `VITE_SUPABASE_URL` 和 `VITE_SUPABASE_ANON_KEY`
- **阶段 2（runtime）**：基于 `node:20-alpine`，仅安装生产依赖，复制构建产物（`dist/`）和服务端代码（`server/`），通过 Express 服务在 8080 端口提供服务

### 5. 验证部署

```bash
# 查看容器状态（应显示 healthy）
docker ps --filter name=familiar

# 测试 HTTP 响应
curl -s -o /dev/null -w "%{http_code}" http://localhost:8080/
# 应返回 200
```

### 6. 清理旧镜像（可选）

```bash
docker image prune -f
```

## 常见问题

### 端口 8080 被占用

```bash
# 查看占用端口的进程/容器
docker ps -a
# 或
lsof -i :8080

# 停止占用端口的旧容器
docker stop <容器ID> && docker rm <容器ID>

# 重新启动
docker compose up -d
```

### 构建时 OOM

Dockerfile 中已设置 `NODE_OPTIONS=--max-old-space-size=4096`。如果服务器内存不足（< 2GB），可能仍会出现 OOM，建议使用 4GB 以上内存的机器。

### 国内网络加速

项目已内置以下加速配置：
- Docker 镜像：默认使用 DaoCloud 镜像源（`docker.m.daocloud.io`）
- npm 依赖：使用 npmmirror（`registry.npmmirror.com`）

如需切换 Docker 镜像源，可在 `.env` 中设置：

```bash
IMAGE_REGISTRY=your.mirror.registry
```

## GitHub Actions 自动部署

项目配置了 `.github/workflows/deploy.yml`，当 `main` 分支有新推送时会自动部署。

需要在 GitHub 仓库 Settings > Secrets 中配置以下 Secrets：

| Secret 名 | 说明 |
|---|---|
| `ECS_HOST` | 服务器 IP 地址 |
| `ECS_USER` | SSH 用户名 |
| `ECS_SSH_KEY` | SSH 私钥 |
| `DEPLOY_PATH` | 部署路径（如 `/opt/Familiar`） |
| `VITE_SUPABASE_URL` | Supabase 项目 URL |
| `VITE_SUPABASE_ANON_KEY` | Supabase 匿名密钥 |

自动部署流程：SSH 登录 > `git pull` > 写入 `.env` > `docker compose up --build -d` > 清理旧镜像。
