/**
 * Performance budget definitions for Bunlet.
 *
 * These budgets act as release gates — if any budget is exceeded,
 * the CI pipeline should warn or fail.
 */

export interface PerformanceBudget {
  name: string;
  metric: 'medianMs' | 'p95Ms' | 'rssBytes' | 'heapBytes';
  budget: number;
  unit: 'ms' | 'bytes';
}

export const performanceBudgets: PerformanceBudget[] = [
  {
    name: 'IPC serialization',
    metric: 'medianMs',
    budget: 0.5,
    unit: 'ms',
  },
  {
    name: 'Capability check',
    metric: 'medianMs',
    budget: 0.01,
    unit: 'ms',
  },
  {
    name: 'Session lookup',
    metric: 'medianMs',
    budget: 0.01,
    unit: 'ms',
  },
  {
    name: 'IPC P95 latency',
    metric: 'p95Ms',
    budget: 5,
    unit: 'ms',
  },
  {
    name: 'RSS memory',
    metric: 'rssBytes',
    budget: 100 * 1024 * 1024,
    unit: 'bytes',
  },
  {
    name: 'Heap used',
    metric: 'heapBytes',
    budget: 50 * 1024 * 1024,
    unit: 'bytes',
  },
];

export interface BinarySizeBudget {
  name: string;
  platform: string;
  maxSizeBytes: number;
}

export const binarySizeBudgets: BinarySizeBudget[] = [
  {
    name: 'bunlet-native (macOS ARM64)',
    platform: 'darwin-arm64',
    maxSizeBytes: 5 * 1024 * 1024,
  },
  {
    name: 'bunlet-native (Linux x64)',
    platform: 'linux-x64',
    maxSizeBytes: 5 * 1024 * 1024,
  },
  {
    name: 'bunlet-native (Windows x64)',
    platform: 'win32-x64',
    maxSizeBytes: 6 * 1024 * 1024,
  },
  {
    name: 'bunlet-cef-native (macOS ARM64)',
    platform: 'darwin-arm64',
    maxSizeBytes: 15 * 1024 * 1024,
  },
];

export interface CoverageTarget {
  module: string;
  minimumStatements: number;
  minimumBranches: number;
  minimumFunctions: number;
  minimumLines: number;
}

export const coverageTargets: CoverageTarget[] = [
  {
    module: 'packages/bunlet',
    minimumStatements: 70,
    minimumBranches: 60,
    minimumFunctions: 70,
    minimumLines: 70,
  },
  {
    module: 'packages/bunlet-cli',
    minimumStatements: 60,
    minimumBranches: 50,
    minimumFunctions: 60,
    minimumLines: 60,
  },
];