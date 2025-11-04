#!/usr/bin/env node

/**
 * Generate backend/version.gs containing build metadata derived from Git.
 * This script is intended to run via the pre-commit hook or manually before deploy.
 */

const { execSync } = require('child_process');
const { existsSync, readFileSync, writeFileSync } = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const outputPath = path.join(repoRoot, 'backend', 'version.gs');

function runGit(command, fallback) {
  try {
    return execSync(command, {
      cwd: repoRoot,
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim();
  } catch (error) {
    return fallback;
  }
}

function ensureTrailingNewline(content) {
  return content.endsWith('\n') ? content : content + '\n';
}

const commit = runGit('git rev-parse --short HEAD', 'unknown');
const timestamp = runGit('git log -1 --format=%cI', new Date().toISOString());

const header = [
  '// AUTO-GENERATED FILE. DO NOT EDIT MANUALLY.',
  '// Run `node scripts/write-version.js` to regenerate.',
  ''
].join('\n');

const body = [
  'var BUILD_META = {',
  "  commit: '" + commit + "',",
  "  timestamp: '" + timestamp + "'",
  '};',
  '',
  'function api_getBuildMeta() {',
  '  return BUILD_META;',
  '}',
  ''
].join('\n');

const finalContent = ensureTrailingNewline(header + body);

let existing = '';
if (existsSync(outputPath)) {
  existing = readFileSync(outputPath, 'utf8');
}

if (existing === finalContent) {
  process.exit(0);
}

writeFileSync(outputPath, finalContent);
console.log('Updated build metadata at backend/version.gs');
