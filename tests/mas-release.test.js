import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const packagePath = new URL('../package.json', import.meta.url);
const configPath = new URL('../electron-builder.mas.cjs', import.meta.url);
const preflightPath = new URL('../scripts/mas-preflight.mjs', import.meta.url);
const mainEntitlementsPath = new URL('../build/entitlements.mas.plist', import.meta.url);
const childEntitlementsPath = new URL('../build/entitlements.mas.inherit.plist', import.meta.url);

test('Mac App Store 构建使用固定工具版本和独立预检流程', async () => {
  const [appPackage, config, preflight] = await Promise.all([
    readFile(packagePath, 'utf8').then(JSON.parse),
    readFile(configPath, 'utf8'),
    readFile(preflightPath, 'utf8')
  ]);

  assert.equal(appPackage.devDependencies.electron, '44.0.0');
  assert.equal(appPackage.devDependencies['electron-builder'], '26.15.3');
  assert.equal(appPackage.build.appId, 'com.apopo.leisuresolitaire');
  assert.match(appPackage.scripts['preflight:mas'], /mas-preflight\.mjs/);
  assert.match(appPackage.scripts['dist:mas'], /--universal/);
  assert.match(config, /process\.env\.MAS_BUNDLE_ID/);
  assert.match(config, /process\.env\.MAS_PROVISIONING_PROFILE/);
  assert.match(config, /minimumSystemVersion: '13\.0'/);
  assert.match(config, /forceCodeSigning: true/);
  assert.match(config, /target: \['mas'\]/);
  assert.match(preflight, /com\.apple\.application-identifier/);
  assert.match(preflight, /plistValue\(decodedProfile\.stdout, 'application-identifier'\)/);
});

test('Mac App Store 沙盒权限保持最小化', async () => {
  const [mainEntitlements, childEntitlements] = await Promise.all([
    readFile(mainEntitlementsPath, 'utf8'),
    readFile(childEntitlementsPath, 'utf8')
  ]);

  assert.match(mainEntitlements, /com\.apple\.security\.app-sandbox/);
  assert.match(childEntitlements, /com\.apple\.security\.app-sandbox/);
  assert.match(childEntitlements, /com\.apple\.security\.inherit/);
  for (const entitlement of ['network', 'camera', 'microphone', 'files.user-selected', 'print', 'usb']) {
    assert.doesNotMatch(mainEntitlements, new RegExp(entitlement.replace('.', '\\.')));
  }
});
