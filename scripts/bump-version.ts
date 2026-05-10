#!/usr/bin/env bun
/**
 * Synchronizes version numbers across package.json and Cargo.toml files.
 *
 * Usage:
 *   bun run scripts/bump-version.ts [patch|minor|major|X.Y.Z]
 *
 * Examples:
 *   bun run scripts/bump-version.ts patch
 *   bun run scripts/bump-version.ts 0.2.0
 */

import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const SEMVER_REGEX = /^(\d+)\.(\d+)\.(\d+)$/;

function parseVersion(version: string): [number, number, number] {
  const match = version.match(SEMVER_REGEX);
  if (!match) {
    throw new Error(`Invalid version: ${version}. Expected format: X.Y.Z`);
  }
  return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)];
}

function bump(current: string, type: string): string {
  const [major, minor, patch] = parseVersion(current);
  switch (type) {
    case 'major':
      return `${major + 1}.0.0`;
    case 'minor':
      return `${major}.${minor + 1}.0`;
    case 'patch':
      return `${major}.${minor}.${patch + 1}`;
    default:
      throw new Error(`Unknown bump type: ${type}. Use patch, minor, or major.`);
  }
}

function updateJsonVersion(path: string, newVersion: string): void {
  const content = readFileSync(path, 'utf-8');
  const json = JSON.parse(content);
  json.version = newVersion;
  writeFileSync(path, JSON.stringify(json, null, 2) + '\n');
  console.log(`Updated ${path} -> ${newVersion}`);
}

function updateCargoVersion(path: string, newVersion: string): void {
  let content = readFileSync(path, 'utf-8');
  content = content.replace(
    /^version\s*=\s*"[^"]+"/m,
    `version = "${newVersion}"`
  );
  writeFileSync(path, content);
  console.log(`Updated ${path} -> ${newVersion}`);
}

function main(): void {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: bun run scripts/bump-version.ts [patch|minor|major|X.Y.Z]');
    process.exit(1);
  }

  const rootPackagePath = resolve(process.cwd(), 'package.json');
  const rootPackage = JSON.parse(readFileSync(rootPackagePath, 'utf-8'));
  const currentVersion: string = rootPackage.version;

  const newVersion = SEMVER_REGEX.test(arg) ? arg : bump(currentVersion, arg);
  console.log(`Bumping ${currentVersion} -> ${newVersion}\n`);

  const files = [
    { path: 'package.json', type: 'json' as const },
    { path: 'packages/bunlet/package.json', type: 'json' as const },
    { path: 'packages/bunlet-cli/package.json', type: 'json' as const },
    { path: 'packages/bunlet-native/package.json', type: 'json' as const },
    { path: 'packages/bunlet-cef/package.json', type: 'json' as const },
    { path: 'packages/bunlet-native/Cargo.toml', type: 'cargo' as const },
    { path: 'packages/bunlet-cef-native/Cargo.toml', type: 'cargo' as const },
  ];

  for (const file of files) {
    const fullPath = resolve(process.cwd(), file.path);
    try {
      if (file.type === 'json') {
        updateJsonVersion(fullPath, newVersion);
      } else {
        updateCargoVersion(fullPath, newVersion);
      }
    } catch (err) {
      console.error(`Failed to update ${file.path}:`, err);
      process.exit(1);
    }
  }

  console.log(`\nAll files updated to ${newVersion}`);
}

main();
