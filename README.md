# 雾霾探测系统

一个面向手机端的雾霾探测系统，已支持 Web 访问和 Android 原生壳（Capacitor）运行。

## 题目要求覆盖

- 定位城市保存到服务器并在客户端显示
- 动态展示天气和空气质量指数（AQI）
- 根据定位城市拉取天气详情与空气质量并保存到服务器
- 实验报告输出（见 `report.md`）

## 当前技术栈

- 前端：HTML5 + CSS3 + JavaScript（响应式页面）
- 后端：Node.js + Express
- 原生壳：Capacitor + Android
- 定位与地理编码：百度地图 API
- 天气与空气质量：和风天气 API（含 `/airquality/v1/current/{lat}/{lon}`）

## 快速运行（Web）

1. 安装依赖

```bash
npm install
```

2. 启动后端

```bash
npm start
```

3. 浏览器访问

```text
http://localhost:3000
```

## 接口说明

- `GET /api/health`：健康检查
- `POST /api/location`：保存定位城市
- `GET /api/overview`：返回天气、AQI、建议与趋势数据
- `GET /api/history`：查询历史快照

## 环境变量

参考 `.env.example`，常用字段如下：

- `BAIDU_AK`：百度地图 AK
- `HEWEATHER_API_KEY`：和风天气 API Key
- `HEWEATHER_API_HOST`：和风专属 Host

## 原生 App（Android）

1. 配置 App 请求后端地址

- 编辑 `public/config.js`
- 设置 `window.HAZE_API_BASE`，例如：

```js
window.HAZE_API_BASE = 'http://10.0.2.2:3000';
```

说明：

- Android 模拟器访问电脑本机后端使用 `10.0.2.2`。
- 真机调试使用电脑局域网 IP，例如 `http://10.198.217.172:3000`。

2. 同步 Web 资源到原生工程

```bash
npm run cap:sync
```

3. 打开 Android Studio

```bash
npm run cap:android
```

4. 连接真机运行或构建 APK/AAB

完整流程见 `APK_BUILD_CHECKLIST.md`。

## 发布前说明

- `dist/` 为构建产物，已加入忽略规则
- `.env` 已被忽略，不会进入仓库
- 每次改动前端后需要重新执行 `npm run cap:sync`
