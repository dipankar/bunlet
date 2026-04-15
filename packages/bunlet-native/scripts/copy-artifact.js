#!/usr/bin/env bun
const platform = process.platform;
const arch = process.arch;

const artifacts: Record<string, Record<string, string>> = {
  linux: {
    x64: { src: 'target/release/libbunlet_native.so', dest: 'bunlet-native.linux-x64-gnu.node' },
    arm64: { src: 'target/release/libbunlet_native.so', dest: 'bunlet-native.linux-arm64-gnu.node' },
  },
  darwin: {
    x64: { src: 'target/release/libbunlet_native.dylib', dest: 'bunlet-native.darwin-x64.node' },
    arm64: { src: 'target/release/libbunlet_native.dylib', dest: 'bunlet-native.darwin-arm64.node' },
  },
  win32: {
    x64: { src: 'target/release/bunlet_native.dll', dest: 'bunlet-native.win32-x64-msvc.node' },
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

const src = artifact.src.replace('/release/', `/${mode}/`);
const dest = artifact.dest;

const fs = require('fs');
if (!fs.existsSync(src)) {
  console.error(`Native artifact not found: ${src}`);
  console.error(`Make sure 'cargo build${mode === 'release' ? ' --release' : ''}' completed successfully.`);
  process.exit(1);
}

fs.copyFileSync(src, dest);
console.log(`Copied ${src} -> ${dest}`);