# 悠然纸牌

一款为长者设计的单人桌面纸牌合集，包含十二种玩法和清晰舒适的大字界面。

## 游戏内容

热门经典：

- 纸牌（Klondike，翻一张 / 翻三张）
- 空当接龙
- 蜘蛛纸牌（单花色 / 双花色 / 四花色）
- 三峰纸牌
- 金字塔纸牌

趣味挑战：

- 高尔夫纸牌
- 育空接龙
- 蝎子纸牌
- 四十大盗
- 贝克接龙
- Aces Up（四 A 通关）
- 时钟纸牌

## 适老功能

- 大、特大、超大三档卡牌
- 单击自动移动，也支持先点牌、再点目标位置
- 无限撤销和逐步提示
- 高对比度、减少动画、可选操作声音
- 大按钮、清晰中文规则和键盘操作
- 自动保存当前牌局，关闭后可以继续
- 默认不计时，不制造时间压力

## 本地运行

需要 Node.js 22 或更新版本。

```bash
npm install
npm start
```

快捷键：

- `Ctrl/Command + Z`：撤销
- `H`：提示

## 运行测试

```bash
npm test
npm run check
```

## 生成桌面程序

macOS 应用目录：

```bash
npm run dist:mac
```

生成位置：`dist/mac-arm64/悠然纸牌.app`（Apple 芯片 Mac）。

Windows 免安装便携版：

```bash
npm run dist:win
```

Windows 默认生成 64 位便携版，可以直接复制到目标电脑运行。

## 项目结构

- `electron/main.cjs`：桌面窗口入口
- `src/core.js`：牌组、洗牌与通用规则工具
- `src/games/basic.js`：热门经典玩法
- `src/games/expansion.js`：趣味挑战玩法
- `src/app.js`：本地存档、操作流程与牌桌渲染
- `src/styles.css`：适老界面样式
- `tests/`：规则和引擎测试
