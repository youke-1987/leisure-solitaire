import { execFileSync, spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const checks = [];

function record(ok, message, detail = '') {
  checks.push({ ok, message, detail });
}

function run(command, args = []) {
  return spawnSync(command, args, {
    cwd: projectRoot,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe']
  });
}

function plistValue(xml, key) {
  const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return xml.match(new RegExp(`<key>${escapedKey}</key>\\s*<string>([^<]+)</string>`))?.[1] || '';
}

function checkFile(relativePath, label) {
  const absolutePath = path.join(projectRoot, relativePath);
  record(existsSync(absolutePath), label, relativePath);
}

console.log('悠然纸牌 · Mac App Store 上架预检\n');

record(process.platform === 'darwin', '当前系统是 macOS', process.platform);

const xcodePath = run('/usr/bin/xcode-select', ['-p']);
record(xcodePath.status === 0, '已安装并选择 Xcode', (xcodePath.stdout || xcodePath.stderr).trim());

const xcodeReady = run('/usr/bin/xcodebuild', ['-checkFirstLaunchStatus']);
record(
  xcodeReady.status === 0,
  '已接受 Xcode 许可并完成首次启动设置',
  xcodeReady.status === 0 ? '' : '请先运行 sudo xcodebuild -license，并在需要时运行 sudo xcodebuild -runFirstLaunch'
);

const appPackage = JSON.parse(readFileSync(path.join(projectRoot, 'package.json'), 'utf8'));
const bundleId = process.env.MAS_BUNDLE_ID?.trim() || appPackage.build.appId || '';
const validBundleId = /^[A-Za-z0-9]+(?:[.-][A-Za-z0-9-]+)+$/.test(bundleId) && !bundleId.includes('..');
record(validBundleId, '已设置正式 Bundle ID', bundleId || '请设置 MAS_BUNDLE_ID');

const buildNumber = process.env.MAS_BUILD_NUMBER?.trim() || '';
record(
  !buildNumber || /^\d+(?:\.\d+){0,2}$/.test(buildNumber),
  '构建编号格式有效',
  buildNumber || '未设置时使用 package.json 的版本号'
);

const signingIdentities = run('/usr/bin/security', ['find-identity', '-v', '-p', 'codesigning']);
const signingOutput = `${signingIdentities.stdout}\n${signingIdentities.stderr}`;
const hasAppDistribution = /Apple Distribution:|3rd Party Mac Developer Application:/.test(signingOutput);
record(hasAppDistribution, '钥匙串中有 Mac App Store 应用分发证书', hasAppDistribution ? '' : '需要 Apple Distribution 或 Mac App Distribution 证书及其私钥');

const allIdentities = run('/usr/bin/security', ['find-identity', '-v']);
const allIdentityOutput = `${allIdentities.stdout}\n${allIdentities.stderr}`;
const hasInstallerDistribution = /3rd Party Mac Developer Installer:|Mac Installer Distribution:/.test(allIdentityOutput);
record(hasInstallerDistribution, '钥匙串中有 Mac 安装包分发证书', hasInstallerDistribution ? '' : '需要 Mac Installer Distribution 证书及其私钥');

const profileInput = process.env.MAS_PROVISIONING_PROFILE?.trim() || '';
const profilePath = profileInput ? path.resolve(profileInput) : '';
const hasProfile = Boolean(profilePath && existsSync(profilePath));
record(hasProfile, '已设置 Mac App Store Connect provisioning profile', profilePath || '请设置 MAS_PROVISIONING_PROFILE');

if (hasProfile) {
  const decodedProfile = run('/usr/bin/security', ['cms', '-D', '-i', profilePath]);
  if (decodedProfile.status !== 0) {
    record(false, 'provisioning profile 可以被系统读取', decodedProfile.stderr.trim());
  } else {
    const applicationIdentifier =
      plistValue(decodedProfile.stdout, 'com.apple.application-identifier') ||
      plistValue(decodedProfile.stdout, 'application-identifier');
    const profileBundleId = applicationIdentifier.includes('.')
      ? applicationIdentifier.slice(applicationIdentifier.indexOf('.') + 1)
      : '';
    record(
      Boolean(bundleId && profileBundleId === bundleId),
      'provisioning profile 与 Bundle ID 一致',
      profileBundleId || '未读取到 com.apple.application-identifier'
    );
  }
}

checkFile('build/icon.png', '已准备应用图标');
checkFile('build/entitlements.mas.plist', '已准备主进程沙盒权限');
checkFile('build/entitlements.mas.inherit.plist', '已准备子进程沙盒权限');

try {
  const iconInfo = execFileSync('/usr/bin/sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', path.join(projectRoot, 'build/icon.png')], { encoding: 'utf8' });
  record(/pixelWidth:\s+1024/.test(iconInfo) && /pixelHeight:\s+1024/.test(iconInfo), '应用图标是 1024 × 1024', iconInfo.trim().split('\n').slice(-2).join('，'));
} catch (error) {
  record(false, '可以读取应用图标尺寸', error.message);
}

record(appPackage.devDependencies.electron === '44.0.0', 'Electron 版本已固定', appPackage.devDependencies.electron);
record(appPackage.devDependencies['electron-builder'] === '26.15.3', 'electron-builder 版本已固定', appPackage.devDependencies['electron-builder']);

for (const check of checks) {
  console.log(`${check.ok ? '✓' : '✗'} ${check.message}${check.detail ? `：${check.detail}` : ''}`);
}

const failures = checks.filter((check) => !check.ok);
console.log(`\n${failures.length ? `预检未通过：还有 ${failures.length} 项需要处理。` : '预检通过，可以生成 Mac App Store 安装包。'}`);
if (failures.length) process.exitCode = 1;
