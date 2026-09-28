import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const indexPath = new URL('../index.html', import.meta.url);
const appPath = new URL('../src/app.js', import.meta.url);
const packagePath = new URL('../package.json', import.meta.url);

test('界面和桌面程序统一使用新品牌名', async () => {
  const [html, appPackage] = await Promise.all([
    readFile(indexPath, 'utf8'),
    readFile(packagePath, 'utf8').then(JSON.parse)
  ]);
  assert.match(html, /悠然纸牌/);
  assert.equal(appPackage.build.productName, '悠然纸牌');
});

test('首页不把安装方式和联网状态当作卖点', async () => {
  const html = await readFile(indexPath, 'utf8');
  for (const phrase of ['纯本地', '无广告', '全部可以离线', '不需要网络', '所有牌局都保存在这台电脑上']) {
    assert.doesNotMatch(html, new RegExp(phrase));
  }
  assert.match(html, /热门经典/);
  assert.match(html, /趣味挑战/);
  assert.doesNotMatch(html, /扩展游戏|基本游戏/);
});

test('十二款游戏都有独立图形标识并提供多种轻柔音效', async () => {
  const [html, app] = await Promise.all([readFile(indexPath, 'utf8'), readFile(appPath, 'utf8')]);
  const symbols = [...html.matchAll(/<symbol id="(game-[^"]+)"/g)].map((match) => match[1]);
  assert.equal(new Set(symbols).size, 12);
  for (const sound of ['deal', 'move', 'undo', 'hint', 'win']) {
    assert.match(app, new RegExp(`${sound}: \\{`));
  }
});
