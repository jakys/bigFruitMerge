#!/usr/bin/env node
/**
 * 阿里云 Ubuntu 部署脚本（不依赖 bash，避免 Windows CRLF 问题）
 * 用法: sudo node deploy.mjs
 */
import { execSync } from 'child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const WEB_ROOT = '/var/www/daxigua';
const NGINX_CONF = '/etc/nginx/sites-available/daxigua';

function run(cmd) {
  console.log(`> ${cmd}`);
  execSync(cmd, { stdio: 'inherit', env: { ...process.env, DEBIAN_FRONTEND: 'noninteractive' } });
}

function hasNode18() {
  try {
    const v = execSync('node -p "process.version.slice(1).split(\'.\')[0]"', { encoding: 'utf8' }).trim();
    return Number(v) >= 18;
  } catch {
    return false;
  }
}

if (process.getuid && process.getuid() !== 0) {
  console.error('请使用 root 执行: sudo node deploy.mjs');
  process.exit(1);
}

console.log('==> [1/5] 安装 Nginx...');
run('apt update');
run('apt install -y nginx curl ca-certificates gnupg');

if (!hasNode18()) {
  console.log('==> 安装 Node.js 20...');
  run('curl -fsSL https://deb.nodesource.com/setup_20.x | bash -');
  run('apt install -y nodejs');
}

console.log('==> [2/5] 构建项目...');
process.chdir(__dirname);

const nodeModules = join(__dirname, 'node_modules');
if (existsSync(nodeModules)) {
  console.log('==> 清理 node_modules（避免从 Windows 上传导致无执行权限）...');
  rmSync(nodeModules, { recursive: true, force: true });
}

const lockFile = join(__dirname, 'package-lock.json');
if (existsSync(lockFile)) {
  run('npm ci');
} else {
  run('npm install');
}

run('npm run build');

console.log('==> [3/5] 发布静态文件...');
mkdirSync(WEB_ROOT, { recursive: true });
for (const name of readdirSync(WEB_ROOT)) {
  rmSync(join(WEB_ROOT, name), { recursive: true, force: true });
}
const distDir = join(__dirname, 'dist');
if (!existsSync(distDir)) {
  console.error('构建失败: dist 目录不存在');
  process.exit(1);
}
for (const entry of readdirSync(distDir)) {
  cpSync(join(distDir, entry), join(WEB_ROOT, entry), { recursive: true });
}
run(`chown -R www-data:www-data ${WEB_ROOT}`);

console.log('==> [4/5] 配置 Nginx...');
const nginxConf = `server {
    listen 80 default_server;
    listen [::]:80 default_server;
    server_name _;
    root ${WEB_ROOT};
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/javascript application/json image/svg+xml;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \\.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2)$ {
        expires 7d;
        add_header Cache-Control "public, immutable";
    }
}
`;
writeFileSync(NGINX_CONF, nginxConf, 'utf8');
run(`ln -sf ${NGINX_CONF} /etc/nginx/sites-enabled/daxigua`);
if (existsSync('/etc/nginx/sites-enabled/default')) {
  rmSync('/etc/nginx/sites-enabled/default');
}

function fetchPublicIp() {
  const ipPattern = /^\d{1,3}(\.\d{1,3}){3}$/;
  const sources = [
    'curl -s --max-time 3 http://100.100.100.200/latest/meta-data/eipv4',
    'curl -s --max-time 3 http://100.100.100.200/latest/meta-data/public-ipv4',
    'curl -4 -s --max-time 3 ifconfig.me',
    'curl -4 -s --max-time 3 icanhazip.com',
  ];
  for (const cmd of sources) {
    try {
      const value = execSync(cmd, { encoding: 'utf8' }).trim();
      if (ipPattern.test(value)) return value;
    } catch { /* try next */ }
  }
  try {
    const lines = execSync('hostname -I', { encoding: 'utf8' }).trim().split(/\s+/);
    for (const line of lines) {
      if (ipPattern.test(line) && !line.startsWith('127.') && !line.startsWith('10.') && !line.startsWith('172.') && !line.startsWith('192.168.')) {
        return line;
      }
    }
  } catch { /* ignore */ }
  return '';
}

console.log('==> [5/5] 启动 Nginx...');
run('nginx -t');
run('systemctl enable nginx');
run('systemctl restart nginx');

const ip = fetchPublicIp();

console.log('');
console.log('==========================================');
if (ip) {
  console.log(`  部署成功: http://${ip}`);
} else {
  console.log('  部署成功！请到阿里云控制台查看公网 IP');
  console.log('  访问: http://<你的公网IP>');
}
console.log('==========================================');
console.log('');
console.log('服务器自检: curl -I http://127.0.0.1');
console.log('期望看到: HTTP/1.1 200 OK');
