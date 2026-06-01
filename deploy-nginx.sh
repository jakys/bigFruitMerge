#!/bin/bash
set -e
WEB_ROOT="/var/www/daxigua"
NGINX_CONF="/etc/nginx/sites-available/daxigua"
PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
if [ "$(id -u)" -ne 0 ]; then
  echo "请使用 root: sudo bash deploy-nginx.sh"
  exit 1
fi
echo "==> [1/5] 安装 Nginx 和 Node.js..."
export DEBIAN_FRONTEND=noninteractive
apt update
apt install -y nginx curl ca-certificates gnupg
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt install -y nodejs
else
  NODE_MAJOR="$(node -p "process.version.slice(1).split('.')[0]")"
  if [ "$NODE_MAJOR" -lt 18 ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
  fi
fi
echo "    Node $(node -v)  npm $(npm -v)"
echo "==> [2/5] 构建项目..."
cd "$PROJECT_DIR"
if [ -d node_modules ]; then
  echo "==> 清理 node_modules（避免 Windows 上传权限问题）..."
  rm -rf node_modules
fi
if [ -f package-lock.json ]; then
  npm ci
else
  npm install
fi
npm run build
echo "==> [3/5] 发布静态文件..."
mkdir -p "$WEB_ROOT"
rm -rf "${WEB_ROOT:?}/"*
cp -r dist/* "$WEB_ROOT/"
chown -R www-data:www-data "$WEB_ROOT"
echo "==> [4/5] 配置 Nginx..."
cat > "$NGINX_CONF" << 'NGINXEOF'
server {
    listen 80 default_server;
    listen [::]:80 default_server;
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
NGINXEOF
ln -sf "$NGINX_CONF" /etc/nginx/sites-enabled/daxigua
rm -f /etc/nginx/sites-enabled/default
echo "==> [5/5] 启动 Nginx..."
nginx -t
systemctl enable nginx
systemctl restart nginx
PUBLIC_IP="$(curl -s --max-time 3 http://100.100.100.200/latest/meta-data/eip 2>/dev/null || true)"
if [ -z "$PUBLIC_IP" ]; then
  PUBLIC_IP="$(curl -s --max-time 3 ifconfig.me 2>/dev/null || true)"
fi
if [ -z "$PUBLIC_IP" ]; then
  PUBLIC_IP="你的公网IP"
fi
echo ""
echo "=========================================="
echo "  部署成功: http://${PUBLIC_IP}"
echo "=========================================="
