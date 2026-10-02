const path = require('node:path');
const { existsSync } = require('node:fs');
const appPackage = require('./package.json');

const bundleId = process.env.MAS_BUNDLE_ID?.trim() || appPackage.build.appId;
const profileInput = process.env.MAS_PROVISIONING_PROFILE?.trim();
const buildNumber = process.env.MAS_BUILD_NUMBER?.trim() || appPackage.version;

if (!profileInput) {
  throw new Error('缺少 MAS_PROVISIONING_PROFILE，请填写 Mac App Store Connect provisioning profile 的路径');
}

const provisioningProfile = path.resolve(profileInput);
if (!existsSync(provisioningProfile)) {
  throw new Error(`找不到 provisioning profile：${provisioningProfile}`);
}

const baseBuild = appPackage.build;

module.exports = {
  ...baseBuild,
  appId: bundleId,
  buildVersion: buildNumber,
  forceCodeSigning: true,
  mac: {
    ...baseBuild.mac,
    minimumSystemVersion: '13.0',
    target: ['mas']
  },
  mas: {
    category: baseBuild.mac.category,
    icon: baseBuild.mac.icon,
    type: 'distribution',
    entitlements: 'build/entitlements.mas.plist',
    entitlementsInherit: 'build/entitlements.mas.inherit.plist',
    provisioningProfile,
    artifactName: '${productName}-${version}-mas-${arch}.${ext}'
  }
};
