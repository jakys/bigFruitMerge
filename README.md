# 合成大西瓜

浏览器版合成大西瓜小游戏，支持默认水果模式与自定义图片模式。

## 功能

- **默认模式**：11 级经典水果合成链（樱桃 → 大西瓜）
- **自定义模式**：上传 2~15 张图片，按像素面积自动排序为合成链
- **本地持久化**：自定义图片保存在浏览器 IndexedDB，刷新后仍可继续
- **响应式**：支持鼠标与触摸操作

## 本地开发

```bash
npm install
npm run dev
```

浏览器访问 http://localhost:5173

## 生产构建

```bash
npm run build
npm run preview   # 本地预览 dist/
```

构建产物在 `dist/` 目录，可部署到任意静态文件服务器。

## 阿里云 Ubuntu 部署（无需 Docker）

### 推荐：用 Node 部署（不受 Windows 换行符影响）

```bash
cd ~/code/daxigua
sudo node deploy.mjs
```

### 或使用 bash 脚本

上传后若报 `$'\r'` 或 `set: invalid option`，先在服务器修复换行：

```bash
cd ~/code/daxigua
sed -i 's/\r$//' deploy-nginx.sh
sudo bash deploy-nginx.sh
```

详细步骤见 **[DEPLOY_ALIYUN.md](./DEPLOY_ALIYUN.md)**。

## Docker 部署（本地/通用）

```bash
docker build -t daxigua .
docker run -p 8080:80 daxigua
```

访问 http://localhost:8080

## 玩法说明

1. 移动鼠标或手指控制掉落物的水平位置
2. 点击或松手释放，让物体下落
3. 两个相同等级的物体碰撞后会合成下一级
4. 合成最大级时获得额外奖励分
5. 物体堆叠超过警戒线并静止 2 秒后游戏结束

## 技术栈

- Vite + TypeScript
- Matter.js（2D 物理引擎）
- IndexedDB（idb 库）

## 目录结构

```
src/
├── config/       # 游戏配置与默认水果
├── game/         # 物理引擎与游戏循环
├── storage/      # IndexedDB 图片存储
├── ui/           # 界面组件
└── main.ts       # 入口
```
