import { afterEach, describe, expect, test } from 'bun:test';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {
  generateBlockMap,
  writeBlockMap,
  readBlockMap,
  calculateDiff,
  calculateReduction,
  generateBlockMapFile,
} from './blockmap';

const tempDirs: string[] = [];

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

function createTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bunlet-blockmap-'));
  tempDirs.push(dir);
  return dir;
}

describe('blockmap generation', () => {
  test('generates block map with correct structure', async () => {
    const dir = createTempDir();
    const filePath = path.join(dir, 'test.bin');
    const data = Buffer.alloc(8192, 0xAB);
    fs.writeFileSync(filePath, data);

    const blockMap = await generateBlockMap(filePath, 4096);

    expect(blockMap.version).toBe(2);
    expect(blockMap.blockSize).toBe(4096);
    expect(blockMap.hashAlgorithm).toBe('sha512');
    expect(blockMap.files).toHaveLength(1);
    expect(blockMap.files[0].name).toBe('test.bin');
    expect(blockMap.files[0].checksums).toHaveLength(2);
    expect(blockMap.files[0].sizes).toEqual([4096, 4096]);
  });

  test('last block can be smaller than block size', async () => {
    const dir = createTempDir();
    const filePath = path.join(dir, 'partial.bin');
    const data = Buffer.alloc(5000, 0x42);
    fs.writeFileSync(filePath, data);

    const blockMap = await generateBlockMap(filePath, 4096);

    expect(blockMap.files[0].checksums).toHaveLength(2);
    expect(blockMap.files[0].sizes).toEqual([4096, 904]);
  });

  test('block map checksums differ for different data', async () => {
    const dir = createTempDir();
    const fileA = path.join(dir, 'a.bin');
    const fileB = path.join(dir, 'b.bin');
    fs.writeFileSync(fileA, Buffer.alloc(4096, 0xAA));
    fs.writeFileSync(fileB, Buffer.alloc(4096, 0xBB));

    const mapA = await generateBlockMap(fileA);
    const mapB = await generateBlockMap(fileB);

    expect(mapA.files[0].checksums[0]).not.toBe(mapB.files[0].checksums[0]);
  });
});

describe('blockmap write/read round-trip', () => {
  test('write and read round-trip preserves data', async () => {
    const dir = createTempDir();
    const filePath = path.join(dir, 'test.bin');
    const blockMapPath = path.join(dir, 'test.bin.blockmap');
    fs.writeFileSync(filePath, Buffer.alloc(8192, 0xFF));

    const blockMap = await generateBlockMap(filePath);
    const result = await writeBlockMap(blockMap, blockMapPath);

    expect(result.path).toBe(blockMapPath);
    expect(result.size).toBeGreaterThan(0);
    expect(result.sha512).toBeTruthy();

    const loaded = readBlockMap(blockMapPath);
    expect(loaded.version).toBe(blockMap.version);
    expect(loaded.files[0].checksums).toEqual(blockMap.files[0].checksums);
  });
});

describe('blockmap diff calculation', () => {
  test('calculates changed blocks between versions', async () => {
    const dir = createTempDir();
    const fileA = path.join(dir, 'v1.bin');
    const fileB = path.join(dir, 'v2.bin');

    fs.writeFileSync(fileA, Buffer.alloc(8192, 0xAA));
    const dataB = Buffer.alloc(8192);
    dataB.fill(0xAA, 0, 4096);
    dataB.fill(0xBB, 4096, 8192);
    fs.writeFileSync(fileB, dataB);

    const mapA = await generateBlockMap(fileA);
    const mapB = await generateBlockMap(fileB);
    const diff = calculateDiff(mapA, mapB);

    expect(diff).toHaveLength(1);
    expect(diff[0].offset).toBe(4096);
    expect(diff[0].size).toBe(4096);
  });

  test('returns empty diff for identical files', async () => {
    const dir = createTempDir();
    const filePath = path.join(dir, 'same.bin');
    fs.writeFileSync(filePath, Buffer.alloc(4096, 0xCC));

    const mapA = await generateBlockMap(filePath);
    const mapB = await generateBlockMap(filePath);
    const diff = calculateDiff(mapA, mapB);

    expect(diff).toHaveLength(0);
  });

  test('calculates reduction percentage', () => {
    const result = calculateReduction(8192, [
      { offset: 4096, size: 4096 },
    ]);

    expect(result.downloadSize).toBe(4096);
    expect(result.reduction).toBe(50);
  });
});

describe('generateBlockMapFile convenience function', () => {
  test('returns null for missing file', async () => {
    const result = await generateBlockMapFile('/nonexistent/file.exe');
    expect(result).toBeNull();
  });

  test('generates block map file alongside package', async () => {
    const dir = createTempDir();
    const filePath = path.join(dir, 'app-1.0.0.exe');
    fs.writeFileSync(filePath, Buffer.alloc(12000, 0xDD));

    const result = await generateBlockMapFile(filePath);

    expect(result).not.toBeNull();
    expect(result!.path).toBe(`${filePath}.blockmap`);
    expect(result!.size).toBeGreaterThan(0);
    expect(fs.existsSync(result!.path)).toBe(true);
  });
});