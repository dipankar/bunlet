const fs = require('fs');
const path = require('path');

const mode = process.argv[2] === 'debug' ? 'debug' : 'release';
const platformArch = `${process.platform}-${process.arch}`;

const sourceByPlatform = {
  linux: 'libbunlet_cef_native.so',
  darwin: 'libbunlet_cef_native.dylib',
  win32: 'bunlet_cef_native.dll',
};

const targetByPlatformArch = {
  'linux-x64': 'bunlet-cef.linux-x64-gnu.node',
  'linux-arm64': 'bunlet-cef.linux-arm64-gnu.node',
  'darwin-x64': 'bunlet-cef.darwin-x64.node',
  'darwin-arm64': 'bunlet-cef.darwin-arm64.node',
  'win32-x64': 'bunlet-cef.win32-x64-msvc.node',
};

const sourceName = sourceByPlatform[process.platform];
const targetName = targetByPlatformArch[platformArch];

if (!sourceName || !targetName) {
  throw new Error(`Unsupported platform for CEF artifact copy: ${platformArch}`);
}

const sourcePath = path.resolve(
  __dirname,
  '..',
  '..',
  'bunlet-cef-native',
  'target',
  mode,
  sourceName
);
const targetPath = path.resolve(__dirname, '..', targetName);

if (!fs.existsSync(sourcePath)) {
  throw new Error(`CEF native artifact not found: ${sourcePath}`);
}

fs.copyFileSync(sourcePath, targetPath);
console.log(`[bunlet-cef] Copied ${path.basename(sourcePath)} -> ${path.basename(targetPath)}`);
