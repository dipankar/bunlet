#!/usr/bin/env bun
/**
 * Lightweight changelog generator based on conventional commits since the last tag.
 *
 * Usage:
 *   bun run scripts/generate-changelog.ts
 *
 * Reads git log, categorizes commits, and prepends a new section to CHANGELOG.md.
 */

import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

const TYPE_EMOJI: Record<string, string> = {
  feat: 'Added',
  fix: 'Fixed',
  docs: 'Changed',
  style: 'Changed',
  refactor: 'Changed',
  perf: 'Changed',
  test: 'Changed',
  build: 'Changed',
  ci: 'Changed',
  chore: 'Changed',
};

interface Commit {
  hash: string;
  type: string;
  scope: string;
  subject: string;
}

function getLastTag(): string | null {
  try {
    return execSync('git describe --tags --abbrev=0', { encoding: 'utf-8' }).trim();
  } catch {
    return null;
  }
}

function getCommitsSince(tag: string | null): Commit[] {
  const range = tag ? `${tag}..HEAD` : 'HEAD';
  const raw = execSync(`git log ${range} --pretty=format:"%H|%s"`, { encoding: 'utf-8' });
  if (!raw.trim()) return [];

  return raw
    .split('\n')
    .map((line) => {
      const [hash, ...rest] = line.split('|');
      const message = rest.join('|');
      const match = message.match(/^(\w+)(?:\(([^)]+)\))?:\s*(.+)$/);
      if (!match) return null;
      return {
        hash: hash.slice(0, 7),
        type: match[1],
        scope: match[2] || '',
        subject: match[3],
      };
    })
    .filter((c): c is Commit => c !== null);
}

function groupCommits(commits: Commit[]): Map<string, Commit[]> {
  const groups = new Map<string, Commit[]>();
  for (const commit of commits) {
    const category = TYPE_EMOJI[commit.type] || 'Changed';
    if (!groups.has(category)) groups.set(category, []);
    groups.get(category)!.push(commit);
  }
  return groups;
}

function formatDate(date = new Date()): string {
  return date.toISOString().split('T')[0];
}

function main(): void {
  const version = JSON.parse(readFileSync('package.json', 'utf-8')).version;
  const lastTag = getLastTag();
  const commits = getCommitsSince(lastTag);

  if (commits.length === 0) {
    console.log('No new commits since last tag. CHANGELOG not modified.');
    return;
  }

  const groups = groupCommits(commits);
  let section = `## [${version}] - ${formatDate()}\n\n`;

  for (const [category, items] of groups) {
    section += `### ${category}\n\n`;
    for (const item of items) {
      const scope = item.scope ? `**${item.scope}:** ` : '';
      section += `- ${scope}${item.subject}\n`;
    }
    section += '\n';
  }

  let changelog: string;
  try {
    changelog = readFileSync('CHANGELOG.md', 'utf-8');
  } catch {
    changelog = '# Changelog\n\nAll notable changes to this project will be documented in this file.\n\n';
  }

  // Insert after the first heading block
  const lines = changelog.split('\n');
  const insertIndex = lines.findIndex((l) => l.startsWith('## [')) || lines.length;
  const updated = [...lines.slice(0, insertIndex), section.trim(), ...lines.slice(insertIndex)].join('\n');

  writeFileSync('CHANGELOG.md', updated + '\n');
  console.log(`Updated CHANGELOG.md with ${commits.length} commits for v${version}`);
}

main();
