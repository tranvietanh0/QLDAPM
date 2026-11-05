import { existsSync } from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = path.join(projectRoot, 'frontend');
const url = process.env.CLIENT_URL || 'http://127.0.0.1:5173';
const command = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
const commandArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'npm run dev -- --host 0.0.0.0']
  : ['run', 'dev', '--', '--host', '0.0.0.0'];

function isOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(500);
    socket.once('connect', () => finish(true));
    socket.once('timeout', () => finish(false));
    socket.once('error', () => finish(false));
  });
}

async function waitForPort(host, port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await isOpen(host, port)) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

function edgePath() {
  const candidates = [
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Microsoft', 'Edge', 'Application', 'msedge.exe')
  ].filter(Boolean);
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}

function openDesktopWindow() {
  const edge = edgePath();
  if (edge) {
    const browser = spawn(edge, [`--app=${url}`, '--new-window'], {
      detached: true,
      stdio: 'ignore',
      windowsHide: false
    });
    browser.unref();
    console.log(`[CLIENT] Desktop window opened: ${url}`);
    return;
  }
  if (process.platform === 'win32') {
    const browser = spawn('cmd.exe', ['/d', '/c', 'start', '', url], {
      detached: true,
      stdio: 'ignore',
      windowsHide: true
    });
    browser.unref();
    console.log(`[CLIENT] Browser opened: ${url}`);
    return;
  }
  console.warn(`[CLIENT] Open this URL manually: ${url}`);
}

let vite = null;
let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  if (!vite || vite.exitCode !== null || !vite.pid) return;
  if (process.platform === 'win32') {
    await new Promise((resolve) => {
      const killer = spawn('taskkill', ['/PID', String(vite.pid), '/T', '/F'], {
        stdio: 'ignore',
        windowsHide: true
      });
      killer.once('error', resolve);
      killer.once('exit', resolve);
    });
  } else {
    vite.kill('SIGTERM');
  }
}

try {
  if (await isOpen('127.0.0.1', 5173)) {
    console.log('[CLIENT] Vite is already running on port 5173.');
    openDesktopWindow();
    process.exit(0);
  }
  vite = spawn(command, commandArgs, {
    cwd: frontendRoot,
    stdio: 'inherit',
    windowsHide: false
  });
  vite.once('error', (error) => {
    console.error('[CLIENT] Cannot start Vite:', error.message);
    process.exitCode = 1;
  });
  if (!await waitForPort('127.0.0.1', 5173, 30_000)) {
    throw new Error('Vite did not listen on port 5173.');
  }
  openDesktopWindow();
  console.log('[CLIENT] Press Ctrl+C to stop the client.');
  vite.once('exit', (code) => {
    if (!stopping) process.exit(code ?? 0);
  });
} catch (error) {
  console.error('[CLIENT] Startup failed:', error.message);
  await stop();
  process.exitCode = 1;
}

process.once('SIGINT', async () => {
  await stop();
  process.exit(0);
});
process.once('SIGTERM', async () => {
  await stop();
  process.exit(0);
});