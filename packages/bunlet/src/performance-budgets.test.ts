import { describe, expect, test } from 'bun:test';
import {
  performanceBudgets,
  binarySizeBudgets,
  coverageTargets,
} from './performance-budgets';
import type { PerformanceBudget } from './performance-budgets';

describe('performance budgets', () => {
  test('all budgets have required fields', () => {
    for (const budget of performanceBudgets) {
      expect(budget.name).toBeTruthy();
      expect(['medianMs', 'p95Ms', 'rssBytes', 'heapBytes']).toContain(budget.metric);
      expect(budget.budget).toBeGreaterThan(0);
      expect(['ms', 'bytes']).toContain(budget.unit);
    }
  });

  test('latency budgets are under 10ms', () => {
    const latencyBudgets = performanceBudgets.filter(
      (b) => b.unit === 'ms'
    );
    for (const budget of latencyBudgets) {
      expect(budget.budget).toBeLessThan(10);
    }
  });

  test('memory budgets are under 200MB', () => {
    const memoryBudgets = performanceBudgets.filter(
      (b) => b.unit === 'bytes'
    );
    for (const budget of memoryBudgets) {
      expect(budget.budget).toBeLessThan(200 * 1024 * 1024);
    }
  });

  test('budgets cover key performance dimensions', () => {
    const budgetNames = new Set(performanceBudgets.map((b) => b.name));
    expect(budgetNames.has('IPC serialization')).toBe(true);
    expect(budgetNames.has('Capability check')).toBe(true);
    expect(budgetNames.has('Session lookup')).toBe(true);
  });

  test('p95 budgets are larger than median budgets', () => {
    const medianBudgets = performanceBudgets.filter(b => b.metric === 'medianMs');
    const p95Budgets = performanceBudgets.filter(b => b.metric === 'p95Ms');

    if (medianBudgets.length > 0 && p95Budgets.length > 0) {
      const medianTotal = medianBudgets.reduce((sum, b) => sum + b.budget, 0);
      const p95Total = p95Budgets.reduce((sum, b) => sum + b.budget, 0);
      expect(p95Total).toBeGreaterThanOrEqual(medianTotal);
    }
  });
});

describe('binary size budgets', () => {
  test('all binary size budgets have valid platforms', () => {
    const validPlatforms = new Set(['darwin-arm64', 'darwin-x64', 'linux-x64', 'win32-x64']);

    for (const budget of binarySizeBudgets) {
      expect(validPlatforms.has(budget.platform)).toBe(true);
      expect(budget.maxSizeBytes).toBeGreaterThan(0);
    }
  });

  test('native addon budgets are under 10MB', () => {
    for (const budget of binarySizeBudgets) {
      if (budget.name.includes('native') && !budget.name.includes('cef')) {
        expect(budget.maxSizeBytes).toBeLessThanOrEqual(10 * 1024 * 1024);
      }
    }
  });

  test('CEF addon budgets are under 20MB', () => {
    for (const budget of binarySizeBudgets) {
      if (budget.name.includes('cef')) {
        expect(budget.maxSizeBytes).toBeLessThanOrEqual(20 * 1024 * 1024);
      }
    }
  });

  test('covers all major platforms', () => {
    const platforms = new Set(binarySizeBudgets.map((b) => b.platform));
    expect(platforms.has('darwin-arm64')).toBe(true);
    expect(platforms.has('linux-x64')).toBe(true);
  });
});

describe('coverage targets', () => {
  test('all coverage targets have valid percentages', () => {
    for (const target of coverageTargets) {
      expect(target.minimumStatements).toBeGreaterThanOrEqual(0);
      expect(target.minimumStatements).toBeLessThanOrEqual(100);
      expect(target.minimumBranches).toBeGreaterThanOrEqual(0);
      expect(target.minimumBranches).toBeLessThanOrEqual(100);
      expect(target.minimumFunctions).toBeGreaterThanOrEqual(0);
      expect(target.minimumFunctions).toBeLessThanOrEqual(100);
      expect(target.minimumLines).toBeGreaterThanOrEqual(0);
      expect(target.minimumLines).toBeLessThanOrEqual(100);
    }
  });

  test('covers core and CLI packages', () => {
    const modules = new Set(coverageTargets.map((t) => t.module));
    expect(modules.has('packages/bunlet')).toBe(true);
    expect(modules.has('packages/bunlet-cli')).toBe(true);
  });

  test('coverage targets are achievable', () => {
    for (const target of coverageTargets) {
      expect(target.minimumStatements).toBeLessThanOrEqual(90);
      expect(target.minimumBranches).toBeLessThanOrEqual(85);
    }
  });
});