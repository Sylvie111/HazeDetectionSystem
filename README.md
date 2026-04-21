# 雾霾探测系统

这是一个面向手机端展示的雾霾探测系统原型，按题目要求覆盖了四个核心点：

- 定位城市并保存到服务器，同时在客户端显示
- 动态显示天气和空气质量指数
- 根据城市查询天气详情和 AQI，并在服务器端保存
- 提供实验报告模板

## 当前实现

- 前端：HTML5、CSS3、JavaScript，适配手机屏幕
- 后端：Node.js、Express
- 数据存储：JSON 文件模拟服务器持久化
- 数据展示：当前城市、温度、湿度、AQI、趋势图、出行建议

## 和题目要求的对应关系

- 定位功能：浏览器定位获取经纬度，服务器保存定位记录，客户端同步显示城市信息
- 界面设计：首页包含天气卡片、AQI 卡片、趋势图和智能建议，适合手机展示
- 天气详情和 AQI：当前版本已接入可运行的数据接口，接口层已预留为可替换的第三方天气源
- 完成报告：已提供 `report.md`

## 需要做什么

源码里调用百度地图、和风天气：

1. 在项目根目录创建 `.env`，参考 `.env.example` 填入百度控制台信息。
2. 准备定位接口的 API Key，例如百度地图 AK。
3. 准备天气和 AQI 的接口 Key，和风天气的 AppKey。
4. 将 `server.js` 里的天气源和定位源替换成官方接口。
5. 把 `report.md` 中的数据来源改成最终提交时实际使用的接口名称。


## 运行方式

1. 安装依赖：

```bash
npm install
```

2. 启动服务：

```bash
npm start
```

3. 浏览器打开：

```text
http://localhost:3000
```

## 打包 Android App（Capacitor）

1. 准备可访问的后端地址（推荐 HTTPS），例如：

```text
https://your-api-domain.com
```

2. 在手机 App 首次启动时通过 URL 参数设置接口前缀（会自动保存到本地）：

```text
file:///android_asset/public/index.html?apiBase=https://your-api-domain.com
```

也可以在 Web 调试阶段使用：

```text
http://localhost:3000/?apiBase=https://your-api-domain.com
```

3. 同步前端资源到 Android 工程：

```bash
npm run cap:sync
```

4. 使用 Android Studio 打开原生工程并运行：

```bash
npm run cap:open
```

5. 在 Android Studio 中连接真机或启动模拟器，然后点击 Run 进行安装调试。

## 什么是 Android Studio

- Android Studio 是 Google 官方的 Android 开发 IDE。
- Capacitor 会生成一个 `android` 原生工程，最终需要在 Android Studio 中编译、签名、打包 APK/AAB。
- 你平时改网页代码；每次改完执行 `npm run cap:sync`，再回 Android Studio 运行即可。

## 接口说明

- `GET /api/health`：健康检查
- `POST /api/location`：保存定位城市
- `GET /api/overview`：获取天气、AQI、建议和趋势图数据
- `GET /api/history`：查询历史快照

## 实现说明

- 定位优先使用浏览器地理位置。
- 服务器会保存定位记录和天气快照。
- 天气与 AQI 接口不可用时，会自动回退到本地模拟数据，保证页面可演示。
- `server.js` 会自动读取项目根目录下的 `.env`，里面可以写百度应用类型、AK 和 IP 白名单。
