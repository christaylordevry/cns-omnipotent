// query-notebook.mjs
// Usage: NOTEBOOK_QUERY="<question>" NOTEBOOK_ID="<id>" node query-notebook.mjs
// Also accepts: node query-notebook.mjs "<question>" "<notebook_id>"
// Compatibility: node query-notebook.mjs "<notebook_id>" "<question>"
// Outputs JSON to stdout: { answer: string, elapsed_ms: number }
// Exit 1 + stderr -> CLI/tool failure or malformed answer

import { access } from 'node:fs/promises';
import { constants } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const DEFAULT_TIMEOUT_S = 20;
const NLM_CANDIDATES = [
  '/home/christ/.local/share/uv/tools/notebooklm-mcp-cli/bin/nlm',
  '/home/christ/.local/bin/nlm',
];
const UVX_PATH = '/home/christ/.local/bin/uvx';

function fail(message) {
  console.error(message);
  process.exit(1);
}

function looksLikeNotebookId(value) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}

function parseInputs() {
  const envQuestion = (process.env.NOTEBOOK_QUERY ?? '').trim();
  const envNotebookId = (process.env.NOTEBOOK_ID ?? '').trim();
  if (envQuestion && envNotebookId) {
    return { question: envQuestion, notebookId: envNotebookId };
  }

  const first = (process.argv[2] ?? '').trim();
  const second = (process.argv[3] ?? '').trim();
  if (!first || !second) {
    fail('usage: NOTEBOOK_QUERY="<question>" NOTEBOOK_ID="<id>" node query-notebook.mjs');
  }

  if (looksLikeNotebookId(first) && !looksLikeNotebookId(second)) {
    return { question: second, notebookId: first };
  }

  return { question: first, notebookId: second };
}

function parseTimeoutMs() {
  const parsed = Number(process.env.NOTEBOOK_REMAINING_S ?? DEFAULT_TIMEOUT_S);
  const seconds = Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_S;
  return Math.max(1, Math.floor(seconds * 1000));
}

async function isExecutable(path) {
  try {
    await access(path, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

async function resolveCommand() {
  const override = (process.env.NOTEBOOK_NLM_BIN ?? '').trim();
  if (override) {
    return { command: override, prefixArgs: [] };
  }

  for (const path of NLM_CANDIDATES) {
    if (await isExecutable(path)) {
      return { command: path, prefixArgs: [] };
    }
  }

  if (await isExecutable(UVX_PATH)) {
    return {
      command: UVX_PATH,
      prefixArgs: ['--from', 'notebooklm-mcp-cli', 'nlm'],
    };
  }

  fail('notebooklm CLI not found');
}

function answerFromJson(value) {
  if (typeof value === 'string') {
    return value;
  }

  if (!value || typeof value !== 'object') {
    return null;
  }

  for (const key of ['answer', 'response', 'text', 'content', 'message', 'result']) {
    const candidate = value[key];
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate;
    }
  }

  for (const key of ['value', 'data', 'output']) {
    const nested = answerFromJson(value[key]);
    if (nested) {
      return nested;
    }
  }

  return null;
}

function extractAnswer(stdout) {
  const trimmed = stdout.trim();
  if (!trimmed) {
    return null;
  }

  try {
    return answerFromJson(JSON.parse(trimmed));
  } catch {
    return trimmed;
  }
}

const { question, notebookId } = parseInputs();
const timeoutMs = parseTimeoutMs();
const start = Date.now();
const { command, prefixArgs } = await resolveCommand();

const args = [
  ...prefixArgs,
  'query',
  'notebook',
  notebookId,
  question,
  '--json',
  '--timeout',
  String(timeoutMs / 1000),
];

try {
  const { stdout } = await execFileAsync(command, args, {
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });
  const answer = extractAnswer(stdout);
  if (!answer || !answer.trim()) {
    fail('notebook query returned no answer');
  }

  process.stdout.write(JSON.stringify({ answer: answer.trim(), elapsed_ms: Date.now() - start }) + '\n');
} catch (error) {
  if (error.killed || error.code === 'ETIMEDOUT') {
    fail(`notebook query timed out after ${timeoutMs / 1000}s`);
  }

  const details = [
    error.stderr?.trim(),
    error.stdout?.trim(),
    error.message,
  ].filter(Boolean).join('\n');
  fail(details || 'notebook query failed');
}
