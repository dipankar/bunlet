#!/usr/bin/env bun
const fs = require('fs');

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

const artifacts = {
  linux: {
    x64: { filename: 'libbunlet_native.so', dest: 'bunlet-native.linux-x64-gnu.node' },
    arm64: { filename: 'libbunlet_native.so', dest: 'bunlet-native.linux-arm64-gnu.node' },
  },
  darwin: {
    x64: { filename: 'libbunlet_native.dylib', dest: 'bunlet-native.darwin-x64.node' },
    arm64: { filename: 'libbunlet_native.dylib', dest: 'bunlet-native.darwin-arm64.node' },
  },
  win32: {
    x64: { filename: 'bunlet_native.dll', dest: 'bunlet-native.win32-x64-msvc.node' },
  },
};

const mode = process.argv[2] === 'debug' ? 'debug' : 'release';
const platformArtifacts = artifacts[platform];
if (!platformArtifacts) {
  console.error(`Unsupported platform: ${platform}`);
  process.exit(1);
}

const artifact = platformArtifacts[arch];
if (!artifact) {
  console.error(`Unsupported arch: ${arch} on ${platform}`);
  process.exit(1);
}

const targetDir = target ? `target/${target}/${mode}` : `target/${mode}`;
const src = `${targetDir}/${artifact.filename}`;
const dest = artifact.dest;

if (!fs.existsSync(src)) {
  console.error(`Native artifact not found: ${src}`);
  console.error(`Make sure 'cargo build${mode === 'release' ? ' --release' : ''}' completed successfully.`);
  process.exit(1);
}

fs.copyFileSync(src, dest);
console.log(`Copied ${src} -> ${dest}`);
