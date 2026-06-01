# 阿里云 Ubuntu 部署（无需 Docker）

---

## 推荐方式：Node 部署（避免 bash 换行符问题）

Windows 上传的 `.sh` 文件常带 CRLF 换行，Linux 会报错。请改用 **Node 脚本**：

```bash
cd ~/code/daxigua
sudo node deploy.mjs
```

`deploy.mjs` 不依赖 bash，不受 `^M` 换行符影响。

---

## 若坚持用 bash 脚本

**必须先修复换行符**，再执行：

```bash
cd ~/code/daxigua
sed -i 's/\r$//' deploy-nginx.sh
sudo bash deploy-nginx.sh
```

或：

```bash
tr -d '\r' < deploy-nginx.sh > /tmp/deploy-fixed.sh
sudo bash /tmp/deploy-fixed.sh
```

---

## 一键命令（不依赖任何脚本文件）

直接粘贴到服务器终端：

```bash
cd ~/code/daxigua && export DEBIAN_FRONTEND=noninteractive && apt update && apt install -y nginx curl ca-certificates gnupg && (curl -fsSL https://deb.nodesource.com/setup_20.x | bash -) && apt install -y nodejs && npm install && npm run build && mkdir -p /var/www/daxigua && rm -rf /var/www/daxigua/* && cp -r dist/* /var/www/daxigua/ && chown -R www-data:www-data /var/www/daxigua && printf '%s\n' 'server {' '    listen 80 default_server;' '    listen [::]:80 default_server;' '    server_name _;' '    root /var/www/daxigua;' '    index index.html;' '    gzip on;' '    gzip_types text/plain text/css application/javascript application/json image/svg+xml;' '    location / { try_files $uri $uri/ /index.html; }' '    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ { expires 7d; add_header Cache-Control "public, immutable"; }' '}' > /etc/nginx/sites-available/daxigua && ln -sf /etc/nginx/sites-available/daxigua /etc/nginx/sites-enabled/daxigua && rm -f /etc/nginx/sites-enabled/default && nginx -t && systemctl enable nginx && systemctl restart nginx && echo "完成: http://$(curl -s --max-time 3 ifconfig.me 2>/dev/null || echo 你的公网IP)"
```

---

## 安全组

阿里云 ECS → 安全组 → 入方向 → 放行 **TCP 80**

---

## 从 Windows 上传代码

**不要上传 `node_modules` 目录**（会导致 `tsc: Permission denied`）。

```powershell
scp D:\Test\daxigua\deploy.mjs D:\Test\daxigua\package.json D:\Test\daxigua\package-lock.json root@你的IP:~/code/daxigua/
scp -r D:\Test\daxigua\src D:\Test\daxigua\public D:\Test\daxigua\index.html D:\Test\daxigua\vite.config.ts D:\Test\daxigua\tsconfig.json root@你的IP:~/code/daxigua/
```

服务器上依赖由 `npm ci` 自动安装。

---

## 常见报错

| 报错 | 原因 | 解决 |
|------|------|------|
| `tsc: Permission denied` | 上传了 Windows 的 `node_modules` | 服务器执行 `rm -rf node_modules && npm ci`，或重新 `sudo node deploy.mjs` |
| `set: invalid option` | Windows CRLF | 用 `sudo node deploy.mjs` |
| `/bin/bash^M: bad interpreter` | shebang 含 `\r` | 同上，或 `sed -i 's/\r$//' deploy-nginx.sh` |
| `syntax error: unexpected end of file` | if/fi 被 `\r` 破坏 | 同上 |

---

## 部署成功排查清单

按顺序执行，**全部通过即表示部署成功**。

### 1. 服务器内自检（SSH 登录后）

```bash
# ① Nginx 是否在运行（应显示 active (running)）
systemctl status nginx

# ② 配置是否正确（应显示 syntax is ok / test is successful）
nginx -t

# ③ 静态文件是否存在（应能看到 index.html 和 assets 目录）
ls -la /var/www/daxigua/
ls /var/www/daxigua/assets/

# ④ 本机 HTTP 是否正常（应返回 HTTP/1.1 200 OK）
curl -I http://127.0.0.1

# ⑤ 页面内容是否为游戏（应包含「合成大西瓜」字样）
curl -s http://127.0.0.1 | head -20
```

### 2. 外网访问

浏览器打开：

```
http://你的公网IP
```

**成功标志：**

- 能看到「合成大西瓜」主菜单
- 有「默认模式」「自定义图片」按钮
- 点击「默认模式」能进入游戏，水果可以掉落

### 3. 阿里云安全组（外网打不开时重点查）

1. 登录 [ECS 控制台](https://ecs.console.aliyun.com/)
2. 实例 → **安全组** → **入方向**
3. 确认有规则：**TCP 80**，授权对象 `0.0.0.0/0`

服务器内 `curl` 正常但外网打不开 → 几乎一定是安全组未放行 80。

### 4. 防火墙（若启用了 UFW）

```bash
ufw status
# 若 active，需放行：
ufw allow 80/tcp
```

### 5. 快速一键自检脚本

```bash
echo "=== Nginx ===" && systemctl is-active nginx
echo "=== 配置 ===" && nginx -t 2>&1
echo "=== 文件 ===" && ls /var/www/daxigua/index.html 2>&1
echo "=== HTTP ===" && curl -s -o /dev/null -w "状态码: %{http_code}\n" http://127.0.0.1
echo "=== 公网IP ===" && curl -s --max-time 3 ifconfig.me 2>/dev/null || echo "请从控制台查看"
```

**期望输出：**

```
=== Nginx ===
active
=== 配置 ===
nginx: configuration file ... test is successful
=== 文件 ===
/var/www/daxigua/index.html
=== HTTP ===
状态码: 200
=== 公网IP ===
47.96.xxx.xxx
```

### 6. 常见问题对照

| 现象 | 可能原因 | 处理 |
|------|----------|------|
| 服务器内 200，外网超时 | 安全组未放行 80 | 控制台添加规则 |
| `curl` 返回 403 | 目录权限 | `chown -R www-data:www-data /var/www/daxigua` |
| `curl` 返回 404 | 未构建或未复制 dist | 重新 `npm run build` 并复制到 `/var/www/daxigua` |
| 页面空白 | JS 加载失败 | F12 看 Network；确认 `/assets/*.js` 返回 200 |
| Nginx inactive | 服务未启动 | `systemctl start nginx` |
| `index.html` 不存在 | 构建/发布失败 | 重新 `sudo node deploy.mjs` |

---

## 更新版本

```bash
cd ~/code/daxigua
git pull
sudo node deploy.mjs
```
