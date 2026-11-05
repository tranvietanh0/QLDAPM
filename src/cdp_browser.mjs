// Shared helpers for driving headless Edge/Chrome over the DevTools protocol (CDP).
// No npm dependencies: relies on the global WebSocket and fetch of Node 22+.
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

export const API = process.env.IMS_API || 'http://127.0.0.1:8081/api';

const BROWSERS = [
  process.env.CDP_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
].filter(Boolean);

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * Launch a headless browser with a throwaway profile and attach to its initial (foreground) tab.
 * A tab opened via /json/new stays in the background, where Chromium throttles rendering, which stalls
 * screenshots and input. Every CDP call rejects after `timeoutMs` instead of hanging.
 * Returns { send, on, evaluate, call, waitFor, close }.
 */
export async function openPage({ port = 9333, width = 1440, height = 900, timeoutMs = 30000 } = {}) {
  const exe = BROWSERS.find(existsSync);
  if (!exe) throw new Error('Edge/Chrome not found (set CDP_BROWSER to the executable path)');
  const profile = mkdtempSync(path.join(tmpdir(), 'ims-cdp-'));
  // The throttling/occlusion switches keep the renderer painting; without them Page.captureScreenshot
  // intermittently never answers on Windows.
  const proc = spawn(exe, ['--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    `--window-size=${width},${height}`, '--hide-scrollbars', '--lang=vi-VN', '--no-first-run', '--no-default-browser-check',
    '--disable-extensions', '--disable-background-timer-throttling', '--disable-backgrounding-occluded-windows',
    '--disable-renderer-backgrounding', '--disable-features=CalculateNativeWinOcclusion', 'about:blank'], { stdio: 'ignore' });
  const cleanup = () => { proc.kill(); sleep(500).then(() => rmSync(profile, { recursive: true, force: true })); };

  let info;
  for (let i = 0; i < 50 && !info; i++) {
    await sleep(200);
    info = await fetch(`http://127.0.0.1:${port}/json/list`)
      .then((r) => (r.ok ? r.json() : [])).then((list) => list.find((t) => t.type === 'page')).catch(() => null);
  }
  if (!info) { cleanup(); throw new Error(`DevTools endpoint on port ${port} did not start`); }

  const ws = new WebSocket(info.webSocketDebuggerUrl);
  try {
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = () => rej(new Error('DevTools WebSocket failed to open')); });
  } catch (e) { cleanup(); throw e; }

  let seq = 0;
  const pending = new Map();
  const listeners = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject, method } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(`${method}: ${msg.error.message}`)); else resolve(msg.result);
    } else if (msg.method) {
      for (const fn of listeners.get(msg.method) || []) fn(msg.params);
    }
  };
  ws.onclose = () => {
    for (const { reject, method } of pending.values()) reject(new Error(`${method}: DevTools connection closed`));
    pending.clear();
  };

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++seq;
    const timer = setTimeout(() => { pending.delete(id); reject(new Error(`${method}: no reply within ${timeoutMs} ms`)); }, timeoutMs);
    const done = (fn) => (v) => { clearTimeout(timer); fn(v); };
    pending.set(id, { resolve: done(resolve), reject: done(reject), method });
    ws.send(JSON.stringify({ id, method, params }));
  });
  const on = (event, fn) => { listeners.set(event, [...(listeners.get(event) || []), fn]); };

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (r.exceptionDetails) throw new Error(`page error: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`);
    return r.result.value;
  };
  // Run a self-contained function in the page with JSON-serialisable arguments.
  const call = (fn, ...args) => evaluate(`(${fn.toString()})(...${JSON.stringify(args)})`);
  const waitFor = async (expression, timeoutMs = 15000) => {
    const end = Date.now() + timeoutMs;
    while (Date.now() < end) {
      if (await evaluate(expression).catch(() => false)) return;
      await sleep(250);
    }
    throw new Error(`timeout waiting for ${expression}`);
  };

  await send('Page.enable');
  await send('Page.bringToFront');
  await send('Emulation.setFocusEmulationEnabled', { enabled: true });
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  const close = () => { ws.close(); cleanup(); };
  return { send, on, evaluate, call, waitFor, close };
}

/** Log in through the REST API and return the JWT (used to skip the login form). */
export async function apiLogin(portal, email) {
  const password = process.env.IMS_DEMO_PASSWORD;
  if (!password) throw new Error('Set IMS_DEMO_PASSWORD (demo password, see app/README.md)');
  const res = await fetch(`${API}/auth/${portal}/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(`login ${email} failed: ${res.status}`);
  return (await res.json()).token;
}

/**
 * Record a page by polling Page.captureScreenshot (~12.5 fps) into `framesDir`, then encode the frames to a
 * constant-frame-rate H.264 MP4 using their real capture timestamps. Page.startScreencast is avoided because it
 * stops after cross-process navigations. Returns { start, stop, pause, resume, encode, now, frames }.
 */
export function createRecorder(page, { framesDir, frameMs = 80, quality = 88 }) {
  const frames = []; // { file, ts }
  const now = () => Date.now() / 1000;
  let recording = false, paused = false, loop = null;
  async function captureLoop() {
    while (recording) {
      const t = now();
      if (!paused) {
        const shot = await Promise.race([
          page.send('Page.captureScreenshot', { format: 'jpeg', quality }),
          sleep(3000).then(() => null),
        ]).catch(() => null);
        if (shot && !paused) {
          const file = path.join(framesDir, `f${String(frames.length).padStart(6, '0')}.jpg`);
          writeFileSync(file, Buffer.from(shot.data, 'base64'));
          frames.push({ file, ts: t });
        }
      }
      const wait = frameMs - (now() - t) * 1000;
      if (wait > 0) await sleep(wait);
    }
  }
  return {
    frames, now,
    start() { recording = true; loop = captureLoop(); },
    async stop() { recording = false; await loop?.catch(() => {}); },
    pause() { paused = true; },
    resume() { paused = false; },
    /** Encode captured frames; each frame lasts until the next one was captured. */
    encode({ ffmpeg, out, width = 1440, height = 900, fps = 25, crf = 20, endTs = now() }) {
      if (frames.length < 2) throw new Error('no frames were captured');
      const lines = ['ffconcat version 1.0'];
      const unix = (p) => p.split(path.sep).join('/');
      frames.forEach((f, i) => {
        const next = i + 1 < frames.length ? frames[i + 1].ts : Math.max(endTs, f.ts + 1 / fps);
        lines.push(`file '${unix(f.file)}'`, `duration ${Math.max(1 / fps, next - f.ts).toFixed(4)}`);
      });
      lines.push(`file '${unix(frames.at(-1).file)}'`);
      const list = path.join(framesDir, 'frames.ffconcat');
      writeFileSync(list, lines.join('\n'));
      mkdirSync(path.dirname(out), { recursive: true });
      const r = spawnSync(ffmpeg, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
        '-vf', `fps=${fps},scale=${width}:${height}:flags=lanczos:out_range=tv,format=yuv420p`, '-pix_fmt', 'yuv420p',
        '-color_range', 'tv', '-c:v', 'libx264', '-preset', 'slow', '-crf', String(crf), '-movflags', '+faststart', '-an', out],
      { stdio: 'inherit' });
      if (r.status !== 0) throw new Error(`ffmpeg failed (exit ${r.status})`);
    },
  };
}
