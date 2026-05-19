#!/usr/bin/env bun
/**
 * bunlet smoke - Launch every example briefly and confirm none crash.
 *
 * Strategy: spawn `bun run main.ts` inside each example, give it a fixed
 * window of time to reach "ready" (or print the first window-created log),
 * then SIGTERM. Pass if the process started, stayed alive, and produced no
 * panic / fatal-error markers within the window.
 *
 * Skips renderer-server-dependent examples unless BUNLET_SMOKE_FULL=1.
 * On Linux without DISPLAY, exits 0 (cannot run a window manager).
 */

import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'bun';

const ROOT = path.resolve(import.meta.dir, '..');
const EXAMPLES_DIR = path.join(ROOT, 'examples');

const FATAL_PATTERNS = [
  /panicked at/i,
  /thread '.*' panicked/i,
  /fatal error/i,
  /uncaught\s+\w*error/i,
  /\bsegmentation fault\b/i,
  /\bSIGSEGV\b/,
  /failed to load native binding/i,
  /Cannot find module/i,
];

interface ExampleSpec {
  name: string;
  requiresViteServer?: boolean;
  liveSeconds?: number;
}

const EXAMPLES: ExampleSpec[] = [
  { name: 'hello-world' },
  { name: 'multi-window' },
  { name: 'tray-app' },
  { name: 'clipboard-manager' },
  { name: 'file-browser' },
  { name: 'power-monitor' },
  { name: 'notes-app', requiresViteServer: true },
];

const LIVE_SECONDS_DEFAULT = 4;

interface RunResult {
  name: string;
  status: 'pass' | 'fail' | 'skip';
  detail: string;
  stdoutTail: string;
  stderrTail: string;
}

function tail(s: string, n = 800): string {
  if (s.length <= n) return s;
  return '…' + s.slice(-n);
}

async function runOne(spec: ExampleSpec): Promise<RunResult> {
  const dir = path.join(EXAMPLES_DIR, spec.name);
  const main = path.join(dir, 'main.ts');
  if (!fs.existsSync(main)) {
    return { name: spec.name, status: 'fail', detail: `main.ts missing at ${main}`, stdoutTail: '', stderrTail: '' };
  }

  if (spec.requiresViteServer && process.env.BUNLET_SMOKE_FULL !== '1') {
    return {
      name: spec.name,
      status: 'skip',
      detail: 'requires renderer dev server (set BUNLET_SMOKE_FULL=1 to attempt)',
      stdoutTail: '',
      stderrTail: '',
    };
  }

  const liveSeconds = spec.liveSeconds ?? LIVE_SECONDS_DEFAULT;
  const proc = spawn({
    cmd: ['bun', 'run', 'main.ts'],
    cwd: dir,
    stdout: 'pipe',
    stderr: 'pipe',
    env: { ...process.env, BUNLET_SMOKE: '1' },
  });

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];

  const drain = async (stream: ReadableStream<Uint8Array> | null, sink: string[]) => {
    if (!stream) return;
    const reader = stream.getReader();
    const dec = new TextDecoder();
    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        sink.push(dec.decode(value));
      }
    } catch {}
  };

  const drainOut = drain(proc.stdout as any, stdoutChunks);
  const drainErr = drain(proc.stderr as any, stderrChunks);

  const exitPromise = proc.exited;
  let timedOut = false;
  const timeoutHandle = setTimeout(() => {
    timedOut = true;
  }, liveSeconds * 1000);
  const timeoutPromise = new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), liveSeconds * 1000));

  const winner = await Promise.race([
    exitPromise.then(() => 'exited' as const),
    timeoutPromise,
  ]);
  clearTimeout(timeoutHandle);

  let exitCode: number | null = null;
  const exitedEarly = winner === 'exited';
  if (exitedEarly) {
    exitCode = await exitPromise;
  } else {
    proc.kill('SIGTERM');
    const killTimer = setTimeout(() => {
      try {
        proc.kill('SIGKILL');
      } catch {}
    }, 2000);
    exitCode = await exitPromise;
    clearTimeout(killTimer);
  }

  await Promise.allSettled([drainOut, drainErr]);

  const stdout = stdoutChunks.join('');
  const stderr = stderrChunks.join('');
  const combined = stdout + '\n' + stderr;

  for (const pat of FATAL_PATTERNS) {
    if (pat.test(combined)) {
      return {
        name: spec.name,
        status: 'fail',
        detail: `fatal pattern matched: ${pat}`,
        stdoutTail: tail(stdout),
        stderrTail: tail(stderr),
      };
    }
  }

  if (exitedEarly && exitCode !== 0) {
    return {
      name: spec.name,
      status: 'fail',
      detail: `exited early with code ${exitCode} before ${liveSeconds}s window`,
      stdoutTail: tail(stdout),
      stderrTail: tail(stderr),
    };
  }

  return {
    name: spec.name,
    status: 'pass',
    detail: exitedEarly ? `exited cleanly within ${liveSeconds}s` : `alive ${liveSeconds}s, SIGTERM exit=${exitCode}`,
    stdoutTail: tail(stdout, 200),
    stderrTail: tail(stderr, 200),
  };
}

async function main() {
  if (process.platform === 'linux' && !process.env.DISPLAY && !process.env.WAYLAND_DISPLAY) {
    console.log('  Bunlet Smoke - skipped (no DISPLAY or WAYLAND_DISPLAY on Linux)');
    console.log('  Re-run under xvfb-run or set DISPLAY.');
    return;
  }

  console.log('\n  Bunlet Smoke - launching examples\n');
  console.log('  ─────────────────────────────────\n');

  const results: RunResult[] = [];
  for (const spec of EXAMPLES) {
    process.stdout.write(`  ${spec.name.padEnd(20)} ... `);
    const r = await runOne(spec);
    results.push(r);
    if (r.status === 'pass') process.stdout.write(`\x1b[32mPASS\x1b[0m  ${r.detail}\n`);
    else if (r.status === 'skip') process.stdout.write(`\x1b[36mSKIP\x1b[0m  ${r.detail}\n`);
    else process.stdout.write(`\x1b[31mFAIL\x1b[0m  ${r.detail}\n`);
  }

  const failures = results.filter((r) => r.status === 'fail');
  console.log('\n  ─────────────────────────────────\n');

  if (failures.length === 0) {
    const skipped = results.filter((r) => r.status === 'skip').length;
    console.log(`  \x1b[32mAll examples smoked clean\x1b[0m${skipped ? ` (${skipped} skipped)` : ''}.\n`);
    return;
  }

  for (const f of failures) {
    console.log(`\n  --- ${f.name} ---`);
    if (f.stderrTail) console.log(`  stderr: ${f.stderrTail}`);
    if (f.stdoutTail) console.log(`  stdout: ${f.stdoutTail}`);
  }
  console.log(`\n  \x1b[31m${failures.length} example(s) failed.\x1b[0m\n`);
  process.exit(1);
}

await main();
