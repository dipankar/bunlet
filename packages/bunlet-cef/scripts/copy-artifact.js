const fs = require('fs');
const path = require('path');

function parseTarget(target) {
  let platform = process.platform;
  let arch = process.arch;

  if (target.includes('darwin')) platform = 'darwin';
  else if (target.includes('linux')) platform = 'linux';
  else if (target.includes('windows') || target.includes('pc-windows')) platform = 'win32';

  if (target.startsWith('x86_64') || target.startsWith('i686')) arch = 'x64';
  else if (target.startsWith('aarch64') || target.startsWith('arm64')) arch = 'arm64';

  return { platform, arch };
}

const target = process.env.CARGO_BUILD_TARGET;
const { platform, arch } = target ? parseTarget(target) : { platform: process.platform, arch: process.arch };

const mode = process.argv[2] === 'debug' ? 'debug' : 'release';
const platformArch = `${platform}-${arch}`;

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

const helperByPlatform = {
  linux: 'bunlet-cef-helper',
  darwin: 'bunlet-cef-helper',
  win32: 'bunlet-cef-helper.exe',
};

const sourceName = sourceByPlatform[platform];
const targetName = targetByPlatformArch[platformArch];
const helperName = helperByPlatform[platform];

if (!sourceName || !targetName || !helperName) {
  throw new Error(`Unsupported platform for CEF artifact copy: ${platformArch}`);
}

const targetDir = target
  ? path.join('target', target, mode)
  : path.join('target', mode);

const sourcePath = path.resolve(
  __dirname,
  '..',
  '..',
  'bunlet-cef-native',
  targetDir,
  sourceName
);
const targetPath = path.resolve(__dirname, '..', targetName);

if (!fs.existsSync(sourcePath)) {
  throw new Error(`CEF native artifact not found: ${sourcePath}`);
}

fs.copyFileSync(sourcePath, targetPath);
console.log(`[bunlet-cef] Copied ${path.basename(sourcePath)} -> ${path.basename(targetPath)}`);

// Copy the CEF helper binary alongside the .node file
const helperSourcePath = path.resolve(
  __dirname,
  '..',
  '..',
  'bunlet-cef-native',
  targetDir,
  helperName
);
const helperTargetPath = path.resolve(__dirname, '..', helperName);

if (fs.existsSync(helperSourcePath)) {
  fs.copyFileSync(helperSourcePath, helperTargetPath);
  fs.chmodSync(helperTargetPath, 0o755);
  console.log(`[bunlet-cef] Copied ${helperName} -> ${path.basename(helperTargetPath)}`);
} else {
  console.warn(`[bunlet-cef] WARNING: CEF helper binary not found at ${helperSourcePath}`);
}
