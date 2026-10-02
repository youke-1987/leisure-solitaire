# 悠然纸牌 Mac App Store 发布流程

项目已经包含 Mac App Store（MAS）专用构建配置。正式构建使用 MAS 版 Electron、App Sandbox 和最小权限；不会给应用添加网络、相机、麦克风或任意文件访问权限。

## 1. 确定永久标识

在 Apple Developer 网站注册 Explicit App ID 前，先确定最终 Bundle ID。示例仅供格式参考：

```text
com.yourname.leisuresolitaire
```

本项目确定使用：

```text
com.apopo.leisuresolitaire
```

Bundle ID 必须与 Apple Developer、provisioning profile、App Store Connect 和构建命令完全一致。首个构建上传后不能修改。

建议的 App Store Connect 基本信息：

- 平台：macOS
- 名称：悠然纸牌
- 主要语言：简体中文
- 类别：游戏 / 卡牌
- 版本：1.0.0
- 定价：免费
- SKU：`leisure-solitaire-mac-001`（仅供内部识别）
- 支持邮箱：`youke1987@gmail.com`

## 2. 完成 Xcode 初始设置

在终端中接受 Xcode 许可，并按提示完成首次启动组件安装：

```bash
sudo xcodebuild -license
sudo xcodebuild -runFirstLaunch
```

## 3. 准备签名材料

登录 Apple Developer 后准备：

1. Apple Distribution（或 Mac App Distribution）证书及私钥，用于签名应用。
2. Mac Installer Distribution 证书及私钥，用于签名上传用的 `.pkg`。
3. 与正式 Bundle ID 对应的 Explicit App ID。
4. 类型为“Mac App Store Connect”的 distribution provisioning profile。

下载证书后双击安装到“钥匙串访问”。下载 provisioning profile 后保存在本机的固定位置。

## 4. 运行上架预检

```bash
export MAS_PROVISIONING_PROFILE="/绝对路径/悠然纸牌_AppStore.provisionprofile"
export MAS_BUILD_NUMBER="1.0.0"
npm run preflight:mas
```

Bundle ID 已写入 `package.json`。`MAS_BUILD_NUMBER` 可省略；省略时使用 `package.json` 中的版本号。每次重新上传已成功处理过的版本，都需要增加构建编号。

## 5. 生成上传包

```bash
npm run dist:mas
```

构建目标为 Universal，可同时支持 Intel 和 Apple 芯片 Mac。Electron 44 的最低系统版本是 macOS 13。

生成的 `.pkg` 位于 `dist/`，应用已经使用 Mac App Store 分发证书签名。分发签名后的应用不能直接双击运行；正式验证应使用 Mac App Store/TestFlight 下载的版本，或另行创建 `mas-dev` 开发构建。

## 6. App Store Connect 与上传

1. 在 App Store Connect 创建 macOS App 记录。
2. 确保记录中的 Bundle ID 与构建时的 `MAS_BUNDLE_ID` 一致。
3. 使用 Apple Transporter 上传 `dist/` 中的 `.pkg`。
4. 等待 Apple 处理完成，选择构建并填写隐私、年龄分级、价格与销售范围等信息。
5. 上传 Mac 截图，填写审核备注，提交审核。

## 7. 上架资料仍需准备

- App Store 描述、关键词、副标题和版本说明
- 支持 URL：启用 GitHub Pages 后使用 `https://youke-1987.github.io/leisure-solitaire/`
- 隐私政策 URL：启用 GitHub Pages 后使用 `https://youke-1987.github.io/leisure-solitaire/privacy.html`
- macOS 截图
- App 隐私问卷：按当前实现应选择“不收集数据”，提交前仍需再次核对代码与第三方依赖
- 出口合规问卷

不要把证书私钥、App Store Connect API Key、专用密码或 provisioning profile 提交到 Git。
