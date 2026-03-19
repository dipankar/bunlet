/**
 * Block Map Generation
 *
 * Generates block maps for differential updates.
 * Block maps allow downloading only changed portions of an update.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

export interface BlockMap {
  version: number;
  blockSize: number;
  hashAlgorithm: 'sha512';
  checksumBlockSize: number;
  files: FileBlocks[];
}

export interface FileBlocks {
  name: string;
  offset: number;
  checksums: string[];
  sizes: number[];
}

/**
 * Default block size (4KB)
 */
const DEFAULT_BLOCK_SIZE = 4 * 1024;

/**
 * Generate a block map for a file
 */
export async function generateBlockMap(
  filePath: string,
  blockSize = DEFAULT_BLOCK_SIZE
): Promise<BlockMap> {
  const stats = fs.statSync(filePath);
  const fileSize = stats.size;
  const data = fs.readFileSync(filePath);

  const checksums: string[] = [];
  const sizes: number[] = [];

  let offset = 0;
  while (offset < fileSize) {
    const end = Math.min(offset + blockSize, fileSize);
    const block = data.subarray(offset, end);

    // Calculate SHA-512 hash of block
    const hasher = new Bun.CryptoHasher('sha512');
    hasher.update(block);
    const hash = hasher.digest('base64');

    checksums.push(hash);
    sizes.push(block.length);
    offset = end;
  }

  return {
    version: 2,
    blockSize,
    hashAlgorithm: 'sha512',
    checksumBlockSize: blockSize,
    files: [
      {
        name: path.basename(filePath),
        offset: 0,
        checksums,
        sizes,
      },
    ],
  };
}

/**
 * Write block map to file (gzip compressed)
 */
export async function writeBlockMap(
  blockMap: BlockMap,
  outputPath: string
): Promise<{ path: string; size: number; sha512: string }> {
  const json = JSON.stringify(blockMap);
  const compressed = zlib.gzipSync(json);

  fs.writeFileSync(outputPath, compressed);

  // Calculate SHA-512 of compressed block map
  const hasher = new Bun.CryptoHasher('sha512');
  hasher.update(compressed);
  const sha512 = hasher.digest('hex');

  return {
    path: outputPath,
    size: compressed.length,
    sha512,
  };
}

/**
 * Read and decompress a block map
 */
export function readBlockMap(blockMapPath: string): BlockMap {
  const compressed = fs.readFileSync(blockMapPath);
  const json = zlib.gunzipSync(compressed).toString('utf-8');
  return JSON.parse(json);
}

/**
 * Calculate which blocks need to be downloaded
 */
export function calculateDiff(
  currentBlockMap: BlockMap,
  newBlockMap: BlockMap
): { offset: number; size: number }[] {
  const changedBlocks: { offset: number; size: number }[] = [];

  if (
    currentBlockMap.files.length === 0 ||
    newBlockMap.files.length === 0
  ) {
    return changedBlocks;
  }

  const currentFile = currentBlockMap.files[0];
  const newFile = newBlockMap.files[0];
  const blockSize = newBlockMap.blockSize;

  let offset = 0;
  for (let i = 0; i < newFile.checksums.length; i++) {
    const newChecksum = newFile.checksums[i];
    const newSize = newFile.sizes[i];
    const currentChecksum = currentFile.checksums[i];

    // Block is different or doesn't exist in current version
    if (newChecksum !== currentChecksum) {
      changedBlocks.push({
        offset,
        size: newSize,
      });
    }

    offset += newSize;
  }

  return changedBlocks;
}

/**
 * Calculate the download size reduction
 */
export function calculateReduction(
  totalSize: number,
  changedBlocks: { offset: number; size: number }[]
): { downloadSize: number; reduction: number } {
  const downloadSize = changedBlocks.reduce((sum, block) => sum + block.size, 0);
  const reduction = ((totalSize - downloadSize) / totalSize) * 100;

  return {
    downloadSize,
    reduction,
  };
}

/**
 * Generate block map file alongside the package
 */
export async function generateBlockMapFile(
  packagePath: string
): Promise<{ path: string; size: number; sha512: string } | null> {
  if (!fs.existsSync(packagePath)) {
    return null;
  }

  const blockMapPath = `${packagePath}.blockmap`;
  const blockMap = await generateBlockMap(packagePath);

  return writeBlockMap(blockMap, blockMapPath);
}
