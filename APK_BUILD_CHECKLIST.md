# APK 打包步骤清单

## 0. 前置检查

1. 已安装 Node.js、JDK、Android Studio。
2. 已配置 Android SDK 和可用模拟器或真机调试。
3. 后端服务可访问（局域网或公网）。

## 1. 配置后端地址

编辑 `public/config.js`：

```js
window.HAZE_API_BASE = 'http://10.198.217.172:3000';
```

注意：

- 真机运行时不要使用 `localhost`。
- `localhost` 在手机中指向手机自身，而不是电脑。

## 2. 构建并同步资源

```bash
npm install
npm run cap:sync
```

## 3. 打开 Android 工程

```bash
npm run cap:android
```

或：

```bash
npx cap open android
```

## 4. Android Studio 调试运行

1. 连接真机并开启 USB 调试。
2. 在 Android Studio 点击 Run。
3. 首次安装后授予定位权限。

## 5. 功能验收清单

1. 打开 App 后可显示当前城市。
2. 温度、湿度、AQI 有数值且会刷新。
3. 折线图正常渲染。
4. 城市搜索可用。
5. 数据来源显示为 `baidu-map + qweather`（或明确 fallback 状态）。

## 6. 生成发布包

1. Android Studio 中选择 Build -> Generate Signed Bundle / APK。
2. 选择 APK 或 AAB，配置签名信息。
3. 生成后在手机安装测试。

## 7. 变更后重复步骤

每次前端改动后都执行：

```bash
npm run cap:sync
```
