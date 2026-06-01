# 阿里云 Ubuntu 部署指南

本文档适用于 **阿里云 ECS + Ubuntu 22.04/24.04**，提供两种部署方式：

- **方案 A（推荐）**：Docker 一键部署，环境隔离、易维护
- **方案 B**：Nginx 静态部署，不依赖 Docker

> 游戏是纯前端静态站点，无需数据库和后端 API。

---

## 前置准备

### 1. 购买并配置 ECS

| 配置项 | 建议 |
|--------|------|
| 系统 | Ubuntu 22.04 LTS 或 24.04 LTS |
| 规格 | 1 核 2G 即可（静态站点资源占用极低） |
| 带宽 | 按量 1~5 Mbps |
| 安全组 | **入方向放行 TCP 80、443**（如需 SSH 再放行 22） |

### 2. 获取服务器信息

- 公网 IP：例如 `47.96.xxx.xxx`
- SSH 登录：`ssh root@47.96.xxx.xxx`（或 ubuntu 用户）

### 3. 上传代码到服务器

**方式一：Git 克隆（推荐）**

```bash
# 在本地先把代码推送到 GitHub/Gitee，然后在服务器执行：
ssh root@你的公网IP

apt update && apt install -y git
git clone https://github.com/你的用户名/daxigua.git
cd daxigua
```

**方式二：本地上传**

```bash
# 在本地 Windows PowerShell 执行（需安装 OpenSSH）
scp -r D:\Test\daxigua root@你的公网IP:/opt/daxigua
ssh root@你的公网IP
cd /opt/daxigua
```

---

## 方案 A：Docker 部署（推荐）

### 步骤 1：安装 Docker

```bash
# 更新系统
apt update && apt upgrade -y

# 安装 Docker
curl -fsSL https://get.docker.com | sh

# 启动并设置开机自启
systemctl enable docker
systemctl start docker

# 验证
docker --version
```

> 国内服务器若拉取镜像慢，可配置 [阿里云容器镜像加速](https://cr.console.aliyun.com/cn-hangzhou/instances/mirrors)。

### 步骤 2：构建并运行

```bash
cd /opt/daxigua    # 或你的项目目录

# 构建镜像
docker build -t daxigua:latest .

# 后台运行（映射 80 端口）
docker run -d \
  --name daxigua \
  --restart unless-stopped \
  -p 80:80 \
  daxigua:latest
```

### 步骤 3：验证

浏览器访问：

```
http://你的公网IP
```

### 常用运维命令

```bash
# 查看运行状态
docker ps

# 查看日志
docker logs daxigua

# 更新部署（代码变更后）
cd /opt/daxigua
git pull                        # 若用 Git
docker build -t daxigua:latest .
docker stop daxigua && docker rm daxigua
docker run -d --name daxigua --restart unless-stopped -p 80:80 daxigua:latest

# 停止 / 启动
docker stop daxigua
docker start daxigua
```

---

## 方案 B：Nginx 静态部署（无 Docker）

### 步骤 1：安装 Node.js 和 Nginx

```bash
apt update && apt upgrade -y
apt install -y nginx curl

# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

node --version
npm --version
```

### 步骤 2：构建项目

```bash
cd /opt/daxigua

npm install
npm run build
```

构建完成后，静态文件在 `dist/` 目录。

### 步骤 3：配置 Nginx

```bash
# 复制构建产物
mkdir -p /var/www/daxigua
cp -r dist/* /var/www/daxigua/

# 写入 Nginx 配置
cat > /etc/nginx/sites-available/daxigua << 'EOF'
server {
    listen 80;
    server_name _;
    root /var/www/daxigua;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
EOF

# 启用站点
ln -sf /etc/nginx/sites-available/daxigua /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 检查配置并重载
nginx -t
systemctl reload nginx
systemctl enable nginx
```

### 步骤 4：验证

```
http://你的公网IP
```

### 更新部署

```bash
cd /opt/daxigua
git pull                  # 若用 Git
npm install
npm run build
cp -r dist/* /var/www/daxigua/
systemctl reload nginx
```

---

## 绑定域名 + HTTPS（可选）

假设域名为 `game.example.com`，且已解析到 ECS 公网 IP。

### 1. 安装 Certbot

```bash
apt install -y certbot python3-certbot-nginx
```

### 2. 修改 Nginx server_name

**Docker 方式**：编辑项目根目录 `nginx.conf`，将 `server_name localhost;` 改为：

```nginx
server_name game.example.com;
```

然后重新构建并运行 Docker 容器。

**Nginx 方式**：编辑 `/etc/nginx/sites-available/daxigua`，将 `server_name _;` 改为：

```nginx
server_name game.example.com;
```

```bash
nginx -t && systemctl reload nginx
```

### 3. 申请 SSL 证书

```bash
certbot --nginx -d game.example.com
```

按提示输入邮箱并同意条款，Certbot 会自动配置 HTTPS 和自动续期。

---

## 防火墙说明

Ubuntu 若启用了 UFW，需放行端口：

```bash
ufw allow 22/tcp
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
ufw status
```

> **阿里云安全组** 和 **服务器 UFW** 是两层防火墙，都需要放行对应端口。

---

## 故障排查

| 现象 | 排查方法 |
|------|----------|
| 浏览器无法访问 | 检查安全组是否放行 80；`curl -I localhost` 在服务器内测试 |
| Docker 构建失败 | 确认 Node 依赖完整：`npm install && npm run build` 本地能否成功 |
| 页面空白 | 浏览器 F12 看 Console；确认 `dist/` 或容器内 `/usr/share/nginx/html` 有文件 |
| 403 Forbidden | 检查 Nginx `root` 路径权限：`chmod -R 755 /var/www/daxigua` |
| 502 Bad Gateway | Docker 容器是否运行：`docker ps` |

```bash
# 服务器内快速自检
curl -I http://127.0.0.1
docker ps                          # Docker 方式
systemctl status nginx             # Nginx 方式
```

---

## 一键部署脚本（Docker 方式）

将以下内容保存为 `deploy.sh`，在项目根目录执行 `chmod +x deploy.sh && ./deploy.sh`：

```bash
#!/bin/bash
set -e

APP_NAME="daxigua"
IMAGE_NAME="daxigua:latest"
PORT=80

echo "==> 构建镜像..."
docker build -t $IMAGE_NAME .

echo "==> 停止旧容器..."
docker stop $APP_NAME 2>/dev/null || true
docker rm $APP_NAME 2>/dev/null || true

echo "==> 启动新容器..."
docker run -d \
  --name $APP_NAME \
  --restart unless-stopped \
  -p $PORT:80 \
  $IMAGE_NAME

echo "==> 部署完成！访问 http://$(curl -s ifconfig.me 2>/dev/null || echo '你的公网IP')"
docker ps | grep $APP_NAME
```

---

## 最简流程总结

```bash
# 1. SSH 登录阿里云 ECS
ssh root@你的公网IP

# 2. 拉代码
apt update && apt install -y git docker.io
git clone https://github.com/你的用户名/daxigua.git && cd daxigua

# 3. 一键部署
chmod +x deploy.sh && ./deploy.sh

# 4. 浏览器打开
# http://你的公网IP
```
