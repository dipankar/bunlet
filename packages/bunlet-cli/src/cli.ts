#!/usr/bin/env bun
/**
 * Bunlet CLI - Command Line Interface
 *
 * Usage:
 *   bunlet create <app-name>  Create a new Bunlet application
 *   bunlet dev                Start development server
 *   bunlet build              Build for production
 *   bunlet package            Package for distribution
 */

import { Command } from 'commander';
import { createCommand } from './commands/create';
import { devCommand } from './commands/dev';
import { buildCommand } from './commands/build';
import { packageCommand } from './commands/package';
import { publishCommand } from './commands/publish';
import { doctorCommand } from './commands/doctor';
import { parseSourcemapOption } from './commands/build';
import { readFileSync } from 'fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf-8'));

const program = new Command();

program
  .name('bunlet')
  .description('Build cross-platform desktop apps with Bun and WebView')
  .version(pkg.version);

// Create command
program
  .command('create <app-name>')
  .description('Create a new Bunlet application')
  .option('-t, --template <template>', 'Project template (currently: default)', 'default')
  .option('--webview <engine>', 'WebView engine (system, cef)', 'system')
  .option('--no-typescript', 'Use JavaScript instead of TypeScript')
  .option('--no-git', 'Skip git initialization')
  .option('--no-install', 'Skip dependency installation')
  .action(createCommand);

// Dev command
program
  .command('dev')
  .description('Start development server with HMR')
  .option('-p, --port <port>', 'Dev server port', '5173')
  .option('--host <host>', 'Dev server host', 'localhost')
  .option('--no-hmr', 'Disable hot module replacement')
  .option('--no-open', 'Do not open window automatically')
  .option('--devtools', 'Open DevTools on start', false)
  .option('--webview <engine>', 'WebView engine override (system, cef)')
  .action(devCommand);

// Build command
program
  .command('build')
  .description('Build for production')
  .option('--target <target>', 'Build target (win32, darwin, linux, all)', process.platform)
  .option('--outdir <dir>', 'Output directory', './dist')
  .option('--minify', 'Minify output', true)
  .option('--no-minify', 'Disable minification')
  .option('--sourcemap [type]', 'Generate source maps (true, inline, external)', (val: string) => {
    return parseSourcemapOption(val);
  }, false)
  .option('--webview <engine>', 'WebView engine override (system, cef)')
  .action(buildCommand);

// Package command
program
  .command('package')
  .description('Package application for distribution')
  .option('--format <format>', 'Package format (dmg, appimage, deb, exe)')
  .option('--mac', 'Build for macOS')
  .option('--win', 'Build for Windows')
  .option('--linux', 'Build for Linux')
  .option('--sign', 'Sign the package', false)
  .action(packageCommand);

// Publish command
program
  .command('publish')
  .description('Publish packaged application to release provider')
  .option('--github', 'Publish to GitHub Releases')
  .option('--s3', 'Publish to S3')
  .option('--dry-run', 'Preview without uploading')
  .option('--release-notes <file>', 'Path to release notes file')
  .action(publishCommand);

// Doctor command
program
  .command('doctor')
  .description('Check development environment and print diagnostics')
  .action(doctorCommand);

program.parse();
