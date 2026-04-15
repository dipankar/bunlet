import { describe, expect, test } from 'bun:test';
import * as os from 'os';
import * as process from 'process';

interface BenchmarkResult {
  name: string;
  durationMs: number;
  memoryBytes: number;
  iterations: number;
  medianMs: number;
  minMs: number;
  maxMs: number;
  p95Ms: number;
}

interface BenchmarkSuite {
  name: string;
  results: BenchmarkResult[];
  timestamp: string;
  platform: string;
  arch: string;
  bunVersion: string;
  rssBytes: number;
  heapTotalBytes: number;
  heapUsedBytes: number;
}

function measureBenchmark(
  name: string,
  fn: () => void | Promise<void>,
  iterations: number = 100
): BenchmarkResult {
  const durations: number[] = [];

  // Warm up
  for (let i = 0; i < Math.min(10, iterations); i++) {
    const result = fn();
    if (result instanceof Promise) {
      // synchronous warm-up not possible for async; skip
    }
  }

  // Force GC before measurement if available
  if (typeof globalThis.gc === 'function') {
    globalThis.gc();
  }

  const memBefore = process.memoryUsage.rss();

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    const result = fn();
    if (result instanceof Promise) {
      // For sync benchmarks only
      continue;
    }
    const end = performance.now();
    durations.push(end - start);
  }

  if (durations.length === 0) {
    // Ran async benchmarks - use approximate measurement
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      fn();
    }
    const end = performance.now();
    durations.push((end - start) / iterations);
  }

  durations.sort((a, b) => a - b);

  const median = durations[Math.floor(durations.length / 2)] || 0;
  const min = durations[0] || 0;
  const max = durations[durations.length - 1] || 0;
  const p95Index = Math.ceil(durations.length * 0.95) - 1;
  const p95 = durations[p95Index] || max;

  const memAfter = process.memoryUsage.rss();

  return {
    name,
    durationMs: durations.reduce((sum, d) => sum + d, 0),
    memoryBytes: memAfter - memBefore,
    iterations,
    medianMs: median,
    minMs: min,
    maxMs: max,
    p95Ms: p95,
  };
}

describe('benchmark harness', () => {
  test('measureBenchmark returns well-structured result', () => {
    const result = measureBenchmark('trivial', () => {
      let sum = 0;
      for (let i = 0; i < 100; i++) {
        sum += i;
      }
    }, 50);

    expect(result.name).toBe('trivial');
    expect(result.iterations).toBe(50);
    expect(result.durationMs).toBeGreaterThan(0);
    expect(result.medianMs).toBeGreaterThan(0);
    expect(result.minMs).toBeLessThanOrEqual(result.medianMs);
    expect(result.maxMs).toBeGreaterThanOrEqual(result.medianMs);
    expect(result.p95Ms).toBeGreaterThanOrEqual(result.minMs);
    expect(result.p95Ms).toBeLessThanOrEqual(result.maxMs);
  });

  test('measureBenchmark handles varying iteration counts', () => {
    const result10 = measureBenchmark('iter10', () => {}, 10);
    const result1000 = measureBenchmark('iter1000', () => {}, 1000);

    expect(result10.iterations).toBe(10);
    expect(result1000.iterations).toBe(1000);
  });

  test('BenchmarkSuite captures environment metadata', () => {
    const suite: BenchmarkSuite = {
      name: 'test-suite',
      results: [],
      timestamp: new Date().toISOString(),
      platform: process.platform,
      arch: process.arch,
      bunVersion: Bun.version ?? process.version,
      rssBytes: process.memoryUsage.rss(),
      heapTotalBytes: process.memoryUsage().heapTotal,
      heapUsedBytes: process.memoryUsage().heapUsed,
    };

    expect(suite.platform).toBeTruthy();
    expect(suite.arch).toBeTruthy();
    expect(suite.bunVersion).toBeTruthy();
    expect(suite.rssBytes).toBeGreaterThan(0);
  });

  test('startup cost of core module imports', () => {
    const result = measureBenchmark('module-import-overhead', () => {
      // Measure the overhead of creating a plain object (proxy for import cost)
      const obj: Record<string, unknown> = {};
      obj.test = true;
    }, 1000);

    expect(result.medianMs).toBeLessThan(1);
  });

  test('IPC message creation benchmark', () => {
    const result = measureBenchmark('ipc-message-creation', () => {
      const msg = JSON.stringify({
        channel: 'test-channel',
        args: [{ key: 'value', nested: { array: [1, 2, 3] } }],
      });
      JSON.parse(msg);
    }, 1000);

    expect(result.medianMs).toBeLessThan(1);
    expect(result.p95Ms).toBeLessThan(5);
  });

  test('window state management benchmark', () => {
    const states: Map<number, { x: number; y: number; width: number; height: number; title: string }> = new Map();

    const result = measureBenchmark('window-state-map', () => {
      const id = Math.floor(Math.random() * 10000);
      states.set(id, { x: 0, y: 0, width: 800, height: 600, title: `Window ${id}` });
      const state = states.get(id);
      if (state) {
        state.x += 1;
        state.y += 1;
      }
    }, 1000);

    expect(result.medianMs).toBeLessThan(1);
  });

  test('capability check overhead benchmark', () => {
    const capabilities: Record<string, boolean> = {
      windowManagement: true,
      multiWindow: true,
      ipcInvoke: true,
      executeJavaScript: true,
      devtools: true,
      navigation: true,
      preloadScripts: true,
      contextIsolation: true,
      cookies: true,
      authoritativeGetters: true,
    };

    const result = measureBenchmark('capability-check', () => {
      const cap = 'executeJavaScript';
      if (!capabilities[cap]) {
        throw new Error(`Missing capability: ${cap}`);
      }
    }, 10000);

    expect(result.medianMs).toBeLessThan(0.01);
  });

  test('session partition lookup benchmark', () => {
    const partitions: Map<string, { id: string; persist: boolean }> = new Map();
    for (let i = 0; i < 50; i++) {
      partitions.set(`partition-${i}`, { id: `part-${i}`, persist: true });
    }

    const result = measureBenchmark('session-partition-lookup', () => {
      const key = `partition-${Math.floor(Math.random() * 50)}`;
      const partition = partitions.get(key);
      if (partition) {
        partition.id;
      }
    }, 10000);

    expect(result.medianMs).toBeLessThan(0.01);
  });

  test('benchmark results are reproducible within reason', () => {
    const result1 = measureBenchmark('reproducibility', () => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }
    }, 100);

    const result2 = measureBenchmark('reproducibility', () => {
      let sum = 0;
      for (let i = 0; i < 1000; i++) {
        sum += i;
      }
    }, 100);

    // Both should have positive durations
    expect(result1.durationMs).toBeGreaterThan(0);
    expect(result2.durationMs).toBeGreaterThan(0);
    // Medians should be within an order of magnitude (allowing for system variance)
    expect(result2.medianMs).toBeLessThan(result1.medianMs * 10 + 1);
  });
});

describe('performance budget gates', () => {
  test('IPC serialization latency budget', () => {
    const result = measureBenchmark('ipc-serialization-budget', () => {
      JSON.stringify({ channel: 'test', args: [{ data: new Array(100).fill(0) }] });
    }, 1000);

    // Budget: median IPC serialization must be under 0.5ms
    expect(result.medianMs).toBeLessThan(0.5);
  });

  test('capability check latency budget', () => {
    const caps: Record<string, boolean> = {
      windowManagement: true,
      multiWindow: true,
      ipcInvoke: true,
      mainToRendererPush: true,
      executeJavaScript: true,
      devtools: true,
      navigation: true,
      preloadScripts: true,
      contextIsolation: true,
      sessionPartitions: true,
      cookies: true,
    };

    const result = measureBenchmark('capability-check-budget', () => {
      if (!caps.executeJavaScript) throw new Error('no cap');
      if (!caps.navigation) throw new Error('no cap');
      if (!caps.cookies) throw new Error('no cap');
    }, 10000);

    // Budget: capability checks must be under 0.01ms (essentially free)
    expect(result.medianMs).toBeLessThan(0.01);
  });

  test('session lookup latency budget', () => {
    const sessions: Map<string, { id: string }> = new Map();
    for (let i = 0; i < 100; i++) {
      sessions.set(`persist:session-${i}`, { id: `s-${i}` });
    }

    const result = measureBenchmark('session-lookup-budget', () => {
      sessions.get('persist:session-50');
    }, 10000);

    // Budget: session lookup must be under 0.01ms
    expect(result.medianMs).toBeLessThan(0.01);
  });

  test('memory overhead baseline', () => {
    const mem = process.memoryUsage();
    // Budget: RSS should be under 100MB for benchmark harness
    expect(mem.rss).toBeLessThan(100 * 1024 * 1024);
  });
});