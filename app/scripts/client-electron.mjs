import net from 'node:net';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontendRoot = path.join(projectRoot, 'frontend');
const electronCommand = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : path.join(projectRoot, 'node_modules', '.bin', 'electron');
const electronArgs = process.platform === 'win32'
  ? ['/d', '/s', '/c', 'node_modules\\.bin\\electron.cmd desktop\\main.cjs']
  : ['desktop/main.cjs'];

function isOpen(host, port) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const finish = (value) => {
      socket.removeAllListeners();
      socket.destroy();
      resolve(value);
    };
    socket.setTimeout(400);
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

function stopTree(child) {
  if (!child || child.exitCode !== null || !child.pid) return Promise.resolve();
  if (process.platform !== 'win32') {
    child.kill('SIGTERM');
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore', windowsHide: true });
    killer.once('error', resolve);
    killer.once('exit', resolve);
  });
}

let vite = null;
let electron = null;
let stopping = false;
async function shutdown(code = 0) {
  if (stopping) return;
  stopping = true;
  await stopTree(electron);
  await stopTree(vite);
  process.exit(code);
}

try {
  if (await isOpen('127.0.0.1', 5173)) {
    console.log('[CLIENT] Vite is already running on port 5173.');
  } else {
    const npm = process.platform === 'win32' ? (process.env.ComSpec || 'cmd.exe') : 'npm';
    const npmArgs = process.platform === 'win32'
      ? ['/d', '/s', '/c', 'npm run dev -- --host 0.0.0.0']
      : ['run', 'dev', '--', '--host', '0.0.0.0'];
    vite = spawn(npm, npmArgs, { cwd: frontendRoot, stdio: 'inherit', windowsHide: false });
    vite.once('error', (error) => console.error('[CLIENT] Cannot start Vite:', error.message));
    if (!await waitForPort('127.0.0.1', 5173, 30_000)) {
      throw new Error('Vite did not listen on port 5173.');
    }
  }

  const electronEnv = { ...process.env, ELECTRON_START_URL: 'http://127.0.0.1:5173' };
  delete electronEnv.ELECTRON_RUN_AS_NODE;
  electron = spawn(electronCommand, electronArgs, {
    cwd: projectRoot,
    env: electronEnv,
    stdio: 'inherit',
    windowsHide: false
  });
  electron.once('error', (error) => {
    console.error('[CLIENT] Cannot start Electron:', error.message);
    void shutdown(1);
  });
  electron.once('exit', (code) => {
    if (!stopping) void shutdown(code ?? 0);
  });
  console.log('[CLIENT] Electron desktop window is ready. Press Ctrl+C to stop.');
} catch (error) {
  console.error('[CLIENT] Startup failed:', error.message);
  await shutdown(1);
}

process.once('SIGINT', () => void shutdown(0));
process.once('SIGTERM', () => void shutdown(0));