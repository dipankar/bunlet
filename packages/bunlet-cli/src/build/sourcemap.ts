import * as path from 'path';

export interface SourceMapInput {
  file?: string;
  mappings?: string;
  names?: string[];
  sourceRoot?: string;
  sources?: string[];
  sourcesContent?: (string | null)[];
  version: number;
}

const VLQ_BASE_SHIFT = 5;
const VLQ_BASE = 1 << VLQ_BASE_SHIFT;
const VLQ_BASE_MASK = VLQ_BASE - 1;
const VLQ_CONTINUATION_BIT = VLQ_BASE;

const BASE64_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const BASE64_MAP = new Map<string, number>();
for (let i = 0; i < BASE64_CHARS.length; i++) {
  BASE64_MAP.set(BASE64_CHARS[i], i);
}

export function vlqDecode(encoded: string): number[] {
  const values: number[] = [];
  let i = 0;
  while (i < encoded.length) {
    let result = 0;
    let shift = 0;
    let continuation: boolean;
    do {
      if (i >= encoded.length) return values;
      const char = encoded[i++];
      const digit = BASE64_MAP.get(char);
      if (digit === undefined) return values;
      continuation = !!(digit & VLQ_CONTINUATION_BIT);
      result += (digit & VLQ_BASE_MASK) << shift;
      shift += VLQ_BASE_SHIFT;
    } while (continuation);
    const isNegative = result & 1;
    result >>>= 1;
    values.push(isNegative ? -result : result);
  }
  return values;
}

export function vlqEncode(value: number): string {
  let vlq = value < 0 ? ((-value) << 1) + 1 : value << 1;
  let encoded = '';
  do {
    let digit = vlq & VLQ_BASE_MASK;
    vlq >>>= VLQ_BASE_SHIFT;
    if (vlq > 0) digit |= VLQ_CONTINUATION_BIT;
    encoded += BASE64_CHARS[digit];
  } while (vlq > 0);
  return encoded;
}

export function composeSourceMaps(
  generatedFile: string,
  prependLineCount: number,
  prependSourceMap: SourceMapInput | null,
  originalSourceMap: SourceMapInput | null,
  originalSource: string
): SourceMapInput {
  if (!originalSourceMap) {
    const emptyLines = prependLineCount > 0
      ? Array(prependLineCount).fill('').join(';')
      : '';
    return {
      version: 3,
      file: generatedFile,
      sources: prependSourceMap?.sources ?? [generatedFile],
      sourcesContent: prependSourceMap?.sourcesContent ?? [originalSource],
      names: prependSourceMap?.names ?? [],
      mappings: prependSourceMap?.mappings
        ? shiftAllMappings(
            prependSourceMap.mappings,
            prependLineCount,
            '',
            0,
            0,
          )
        : emptyLines,
    };
  }

  const prependSources = prependSourceMap?.sources ?? [];
  const prependSourcesContent = prependSourceMap?.sourcesContent ?? [];
  const prependNames = prependSourceMap?.names ?? [];
  const prependMappings = prependSourceMap?.mappings ?? '';

  const origMappings = originalSourceMap.mappings ?? '';
  const origSources = originalSourceMap.sources ?? [];
  const origSourcesContent = originalSourceMap.sourcesContent ?? origSources.map(() => null);
  const origNames = originalSourceMap.names ?? [];

  const sources = [...prependSources, ...origSources];
  const sourcesContent = [...prependSourcesContent, ...origSourcesContent];
  const names = [...prependNames, ...origNames];

  const newMappings = shiftAllMappings(
    prependMappings,
    prependLineCount,
    origMappings,
    prependSources.length,
    prependNames.length
  );

  return {
    version: 3,
    file: generatedFile,
    sources,
    sourcesContent,
    names,
    mappings: newMappings,
  };
}

function shiftAllMappings(
  prependMappings: string,
  prependLineCount: number,
  origMappings: string,
  sourceOffset: number,
  nameOffset: number
): string {
  const prependSegs = parseMappings(prependMappings);
  const origSegs = parseMappings(origMappings);

  const allLines: string[] = [];

  for (const line of prependSegs) {
    const encodedLine = line.map((seg) => encodeSegment(seg, 0, 0)).join(',');
    allLines.push(encodedLine);
  }

  while (allLines.length < prependLineCount) {
    allLines.push('');
  }

  for (const line of origSegs) {
    const encodedLine = line.map((seg) => {
      const newSeg = { ...seg };
      if (newSeg.sourceIndex !== undefined) newSeg.sourceIndex += sourceOffset;
      if (newSeg.nameIndex !== undefined) newSeg.nameIndex += nameOffset;
      return encodeSegment(newSeg, sourceOffset, nameOffset);
    }).join(',');
    allLines.push(encodedLine);
  }

  return allLines.join(';');
}

interface Segment {
  generatedColumn: number;
  sourceIndex?: number;
  sourceLine?: number;
  sourceColumn?: number;
  nameIndex?: number;
}

function parseMappings(mappings: string): Segment[][] {
  if (!mappings) return [];
  const lines = mappings.split(';');
  return lines.map((line) => {
    if (!line) return [];
    const segments: Segment[] = [];
    const segParts = line.split(',');
    for (const part of segParts) {
      if (!part) continue;
      const fields = vlqDecode(part);
      const seg: Segment = { generatedColumn: 0 };
      if (fields.length >= 1) seg.generatedColumn = fields[0];
      if (fields.length >= 4) {
        seg.sourceIndex = fields[1];
        seg.sourceLine = fields[2];
        seg.sourceColumn = fields[3];
      }
      if (fields.length >= 5) seg.nameIndex = fields[4];
      segments.push(seg);
    }
    return segments;
  });
}

function encodeSegment(seg: Segment, _sourceOffset: number, _nameOffset: number): string {
  const fields: number[] = [seg.generatedColumn];
  if (seg.sourceIndex !== undefined) {
    fields.push(seg.sourceIndex);
    fields.push(seg.sourceLine ?? 0);
    fields.push(seg.sourceColumn ?? 0);
    if (seg.nameIndex !== undefined) {
      fields.push(seg.nameIndex);
    }
  }
  return fields.map(vlqEncode).join('');
}

export function createIdentitySourceMap(
  file: string,
  source: string,
  sourcePath?: string
): SourceMapInput {
  const lines = source.split('\n');
  const mappings = lines
    .map((_, i) => vlqEncode(0) + vlqEncode(0) + vlqEncode(i) + vlqEncode(0))
    .join(';');

  return {
    version: 3,
    file,
    sources: [sourcePath ?? file],
    sourcesContent: [source],
    names: [],
    mappings,
  };
}

export function appendSourceMapComment(
  content: string,
  sourceMapUrl: string
): string {
  return content + `\n//# sourceMappingURL=${sourceMapUrl}\n`;
}

export function writeSourceMap(
  outDir: string,
  filename: string,
  sourceMap: SourceMapInput
): string {
  const fs = require('fs') as typeof import('fs');
  const fullPath = path.join(outDir, filename);
  fs.writeFileSync(fullPath, JSON.stringify(sourceMap));
  return fullPath;
}