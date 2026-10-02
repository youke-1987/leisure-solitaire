import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexPath = new URL('../index.html', import.meta.url);
const appPath = new URL('../src/app.js', import.meta.url);
const stylesPath = new URL('../src/styles.css', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('界面和桌面程序统一使用新品牌名', async () => {
  const [html, appPackage] = await Promise.all([
    readFile(indexPath, 'utf8'),
    readFile(packagePath, 'utf8').then(JSON.parse)
  ]);
  assert.match(html, /悠然纸牌/);
  assert.equal(appPackage.build.productName, '悠然纸牌');
  assert.equal(appPackage.build.appId, 'com.apopo.leisuresolitaire');
});

test('首页不把安装方式和联网状态当作卖点', async () => {
  const html = await readFile(indexPath, 'utf8');
  for (const phrase of ['纯本地', '无广告', '全部可以离线', '不需要网络', '所有牌局都保存在这台电脑上']) {
    assert.doesNotMatch(html, new RegExp(phrase));
  }
  assert.match(html, /热门经典/);
  assert.match(html, /趣味挑战/);
  assert.match(html, /热门经典<\/h2>\s*<p class="eyebrow">熟悉又耐玩/);
  assert.match(html, /趣味挑战<\/h2>\s*<p class="eyebrow">换一种思路/);
  assert.doesNotMatch(html, /推荐从单花色蜘蛛或三峰开始|七种各有巧思的纸牌玩法/);
  assert.doesNotMatch(html, /扩展游戏|基本游戏/);
});

test('十二款游戏都有独立图形标识并提供多种轻柔音效', async () => {
  const [html, app] = await Promise.all([readFile(indexPath, 'utf8'), readFile(appPath, 'utf8')]);
  const symbols = [...html.matchAll(/<symbol id="(game-[^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(symbols).size, 12);
  for (const sound of ['tap', 'deal', 'move', 'undo', 'hint', 'win']) {
    assert.match(app, new RegExp(`${sound}: \\{`));
  }
  assert.match(app, /document\.addEventListener\('click',[\s\S]*playTone\('tap'\)/);
});

test('牌桌适配当前窗口并从实际结果牌堆播放密集残影胜利动画', async () => {
  const [html, app, styles] = await Promise.all([
    readFile(indexPath, 'utf8'),
    readFile(appPath, 'utf8'),
    readFile(stylesPath, 'utf8')
  ]);
  assert.match(html, /<canvas id="win-celebration"/);
  assert.match(app, /function startWinCelebration\(\)/);
  const celebrationSource = app.slice(app.indexOf('function startWinCelebration()'), app.indexOf('function checkGameEnd()'));
  assert.match(celebrationSource, /const trailStepMs = 28/);
  assert.match(celebrationSource, /let currentCard = null/);
  assert.match(app, /function celebrationPileSources\(/);
  assert.match(app, /\/foundation\|home\/i/);
  assert.match(app, /\/completed\|book\/i/);
  assert.match(app, /node\.getBoundingClientRect\(\)/);
  assert.match(app, /source\.cards\[source\.cards\.length - 1 - depth\]/);
  assert.match(celebrationSource, /const suit = SUIT_INFO\[launch\.card\.suit\]/);
  assert.match(celebrationSource, /if \(!currentCard && spawned < launches\.length\) currentCard = spawnCard\(spawned\+\+\)/);
  assert.doesNotMatch(celebrationSource, /foundationX|launchTop/);
  assert.equal((celebrationSource.match(/context\.clearRect/g) || []).length, 0);
  assert.doesNotMatch(app, /settings\.reduceMotion \|\| !elements\.winCelebration/);
  assert.match(app, /availableFanOffset/);
  assert.match(styles, /grid-template-rows: auto minmax\(0, 1fr\)/);
  assert.match(styles, /\.win-celebration/);
  assert.match(html, /id="skip-win-celebration"/);
  assert.match(app, /function skipWinCelebration\(\)/);
  assert.match(app, /event\.key === 'Escape' && !elements\.winCelebration\.hidden/);
  assert.match(app, /elements\.winCelebration\.addEventListener\('click', skipWinCelebration\)/);
  assert.doesNotMatch(styles, /body\.reduce-motion \.win-celebration/);
});

test('首页标题不会显示启动时的黄色焦点框', async () => {
  const styles = await readFile(stylesPath, 'utf8');
  assert.match(styles, /#home-title:focus-visible\s*\{\s*outline: none;\s*\}/);
});

test('设置中可以查看应用内隐私政策', async () => {
  const [html, app] = await Promise.all([readFile(indexPath, 'utf8'), readFile(appPath, 'utf8')]);
  assert.match(html, /id="privacy-button"/);
  assert.match(html, /id="privacy-dialog"/);
  assert.match(html, /不收集、上传或与第三方共享个人数据/);
  assert.match(html, /youke1987@gmail\.com/);
  assert.match(html, /id="clear-data-button"/);
  assert.match(app, /elements\.privacyButton\.addEventListener\('click'/);
  assert.match(app, /elements\.privacyDialog\.showModal\(\)/);
  assert.match(app, /function clearAllAppData\(\)/);
  assert.match(app, /elements\.clearDataButton\.addEventListener\('click', clearAllAppData\)/);
});

test('所有游戏共用同一套文字操作栏，并保持约定顺序', async () => {
  const [html, styles, app] = await Promise.all([
    readFile(indexPath, 'utf8'),
    readFile(stylesPath, 'utf8'),
    readFile(appPath, 'utf8')
  ]);
  const playIdentityPosition = html.indexOf('id="play-identity"');
  const gameActionsPosition = html.indexOf('id="game-actions"');
  const settingsPosition = html.indexOf('id="settings-button"');
  assert.ok(playIdentityPosition > 0);
  assert.ok(gameActionsPosition > playIdentityPosition);
  assert.match(html.slice(playIdentityPosition, gameActionsPosition), /id="back-button"[\s\S]*id="current-game-title"/);
  assert.match(
    html.slice(gameActionsPosition, settingsPosition),
    /id="new-game-button"[\s\S]*id="hint-button"[\s\S]*id="undo-button"[\s\S]*id="move-count"[\s\S]*id="difficulty-select"[\s\S]*id="rules-button"/
  );
  assert.ok(settingsPosition > html.indexOf('id="rules-button"'));
  assert.match(html, /id="undo-button"[^>]*>撤销<\/button>/);
  assert.match(html, /id="hint-button"[^>]*>提示<\/button>/);
  assert.match(html, /id="settings-button"[^>]*>设置<\/button>/);
  assert.doesNotMatch(html, /💡|⚙|↶/);
  assert.doesNotMatch(html, /<label for="difficulty-select">难度<\/label>/);
  assert.match(html, /id="difficulty-select" aria-label="难度"/);
  assert.match(styles, /--toolbar-button-width: 82px/);
  assert.match(styles, /\.toolbar-button \{[\s\S]*?width: var\(--toolbar-button-width\);[\s\S]*?height: 44px/);
  assert.match(styles, /\.game-actions \{[\s\S]*?gap: 10px/);
  assert.match(styles, /\.topbar-difficulty select \{[\s\S]*?height: 44px/);
  assert.match(app, /difficulty\.label\.replace\(\/\\s\*（\[\^）\]\+）\$\/, ''\)/);
});
