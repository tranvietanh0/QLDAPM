// Record a silent MP4 walkthrough of the running IMS app (Vietnamese UI) with headless Edge/Chrome.
//
//   IMS_DEMO_PASSWORD=... node src/record_demo_video.mjs [output.mp4]
//
// Needs the API on :8081, intern portal on :5173 and admin/mentor portal on :5174 (see app/README.md).
// The demo writes real data: a new task, a weekly report and its review. Frames are captured by polling
// Page.captureScreenshot (Page.startScreencast stops after cross-process navigations) into a temp dir and
// encoded with ffmpeg at a constant frame rate (override the binary with FFMPEG).
// Optional: FRAMES_DIR keeps frames in a chosen directory (otherwise a temp dir is created and removed).
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage, sleep } from './cdp_browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.resolve(process.argv[2] || path.join(ROOT, 'docs', 'video', 'IMS_demo.mp4'));
const FFMPEG = process.env.FFMPEG
  || 'C:/Users/tranv/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const ADMIN = 'http://127.0.0.1:5174';
const INTERN = 'http://127.0.0.1:5173';
const W = 1440, H = 900, FPS = 25;
const PASSWORD = process.env.IMS_DEMO_PASSWORD;

const TASK = {
  title: 'Viết API báo cáo tuần',
  intern: 'Nguyen Van An',
  deadline: '2026-11-27', // inside the internship period 2026-09-01..2027-06-30
  description: 'Xây dựng REST API nộp và chấm báo cáo tuần, kèm kiểm thử tự động.',
};

if (!PASSWORD) { console.error('Set IMS_DEMO_PASSWORD (demo password, see app/README.md)'); process.exit(1); }
if (!existsSync(FFMPEG)) { console.error(`ffmpeg not found at ${FFMPEG} (set FFMPEG)`); process.exit(1); }

// ---------- in-page helpers (serialised into the page, must be self-contained) ----------
const OVERLAY_CSS = `
#demo-caption{position:fixed;left:50%;bottom:28px;transform:translateX(-50%);z-index:2147483646;max-width:1280px;
  padding:16px 30px;border-radius:14px;background:rgba(15,23,42,.88);color:#fff;font:600 27px/1.4 'Segoe UI',Arial,sans-serif;
  text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.35);pointer-events:none;transition:opacity .3s}
body:has(section[role=dialog]) #demo-caption{bottom:auto;top:20px} /* keep modal buttons visible */
#demo-caption small{display:block;font-size:19px;font-weight:400;color:#cbd5e1;margin-top:4px}
#demo-cursor{position:fixed;left:0;top:0;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;z-index:2147483647;
  background:rgba(239,68,68,.35);border:3px solid #ef4444;pointer-events:none;transition:left .6s ease,top .6s ease,transform .15s}
#demo-cursor.down{transform:scale(.6);background:rgba(239,68,68,.7)}
.demo-ring{position:fixed;z-index:2147483645;border:3px solid #f59e0b;border-radius:10px;pointer-events:none;
  box-shadow:0 0 0 6px rgba(245,158,11,.25);transition:opacity .3s}
#demo-card{position:fixed;inset:0;z-index:2147483647;display:flex;flex-direction:column;align-items:center;justify-content:center;
  background:linear-gradient(135deg,#1e3a8a,#4f46e5 55%,#0f766e);color:#fff;font-family:'Segoe UI',Arial,sans-serif;text-align:center;padding:60px}
#demo-card h1{font-size:54px;margin:0 0 22px;font-weight:700} #demo-card p{font-size:30px;margin:8px 0;opacity:.95}`;

function pageEnsureOverlay(css) {
  if (!document.getElementById('demo-style')) {
    const s = document.createElement('style'); s.id = 'demo-style'; s.textContent = css; document.head.appendChild(s);
  }
  return true;
}
function pageCaption(text, sub) {
  let el = document.getElementById('demo-caption');
  if (!text) { el?.remove(); return true; }
  if (!el) { el = document.createElement('div'); el.id = 'demo-caption'; document.body.appendChild(el); }
  el.textContent = text;
  if (sub) { const s = document.createElement('small'); s.textContent = sub; el.appendChild(s); }
  return true;
}
function pageCard(title, lines) {
  document.getElementById('demo-card')?.remove();
  if (!title) return true;
  const el = document.createElement('div'); el.id = 'demo-card';
  const h = document.createElement('h1'); h.textContent = title; el.appendChild(h);
  for (const line of lines) { const p = document.createElement('p'); p.textContent = line; el.appendChild(p); }
  document.body.appendChild(el);
  return true;
}
// Locate a visible element by CSS selector and optional text, scroll it into view and return its centre.
function pageLocate(selector, text, scope) {
  const root = scope ? [...document.querySelectorAll(scope)].pop() : document;
  if (!root) return null;
  const visible = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const el = [...root.querySelectorAll(selector)].filter(visible)
    .find((e) => !text || norm(e.textContent).includes(text) || e.getAttribute('title') === text);
  if (!el) return null;
  el.scrollIntoView({ block: 'center', inline: 'center' });
  const r = el.getBoundingClientRect();
  return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2), w: r.width, h: r.height, l: r.left, t: r.top };
}
function pageCursor(x, y, down) {
  let c = document.getElementById('demo-cursor');
  if (!c) { c = document.createElement('div'); c.id = 'demo-cursor'; c.style.left = (window.__demoX ?? 720) + 'px'; c.style.top = (window.__demoY ?? 450) + 'px'; document.body.appendChild(c); c.getBoundingClientRect(); }
  c.style.left = x + 'px'; c.style.top = y + 'px'; window.__demoX = x; window.__demoY = y;
  c.classList.toggle('down', !!down);
  return true;
}
function pageRing(box, on) {
  document.querySelectorAll('.demo-ring').forEach((e) => e.remove());
  if (!on) return true;
  const d = document.createElement('div'); d.className = 'demo-ring';
  Object.assign(d.style, { left: box.l - 6 + 'px', top: box.t - 6 + 'px', width: box.w + 12 + 'px', height: box.h + 12 + 'px' });
  document.body.appendChild(d);
  return true;
}
// Set a field's value the way React expects (native setter + input/change events).
function pageSetValue(selector, value, scope) {
  const root = scope ? [...document.querySelectorAll(scope)].pop() : document;
  const el = root?.querySelector(selector);
  if (!el) return false;
  const proto = el instanceof HTMLSelectElement ? HTMLSelectElement : el instanceof HTMLTextAreaElement ? HTMLTextAreaElement : HTMLInputElement;
  Object.getOwnPropertyDescriptor(proto.prototype, 'value').set.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
function pageSelectByText(selector, text, scope) {
  const root = scope ? [...document.querySelectorAll(scope)].pop() : document;
  const el = root?.querySelector(selector);
  const opt = el && [...el.options].find((o) => o.textContent.trim() === text);
  if (!opt) return false;
  el.value = opt.value;
  el.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}
// Tag the table row that contains every given text. Rows remount after each reload, so callers re-tag by the
// stable position among matching rows; index -1 means the last row that has a button labelled `button`.
function pageTagRow(texts, index, button) {
  document.querySelectorAll('[data-demo-row]').forEach((e) => e.removeAttribute('data-demo-row'));
  const rows = [...document.querySelectorAll('tbody tr')].filter((r) => texts.every((t) => r.innerText.includes(t)));
  let i = index;
  if (i < 0) i = rows.map((r) => [...r.querySelectorAll('button')].some((b) => b.textContent.trim() === button)).lastIndexOf(true);
  if (i < 0 || !rows[i]) return -1;
  rows[i].setAttribute('data-demo-row', '1');
  return i;
}
function pageText(selector) { return [...document.querySelectorAll(selector)].map((e) => e.textContent).join('\n'); }

// ---------- recorder ----------
const framesDir = process.env.FRAMES_DIR ? path.resolve(process.env.FRAMES_DIR) : mkdtempSync(path.join(tmpdir(), 'ims-frames-'));
mkdirSync(framesDir, { recursive: true });
const frames = []; // { file, ts }
const marks = []; // { label, ts }
let firstTs = null;
const FRAME_MS = 80; // ~12.5 captures per second; ffmpeg resamples to a constant FPS

const page = await openPage({ port: 9334, width: W, height: H });
const { send, call, waitFor } = page;

// The Admin desktop app serves the UI and an /api proxy from one origin and drops the browser Origin header
// before forwarding (app/desktop/main.cjs). The Vite dev server on :5174 forwards Origin instead, and the API's
// CORS list only holds the intern portal, so POST/PUT from :5174 would get HTTP 403. Mirror the desktop proxy by
// removing Origin from the admin portal's own same-origin /api requests.
page.on('Fetch.requestPaused', ({ requestId, request }) => {
  const headers = Object.entries(request.headers).filter(([k]) => k.toLowerCase() !== 'origin').map(([name, value]) => ({ name, value }));
  send('Fetch.continueRequest', { requestId, headers }).catch((e) => console.error('continueRequest:', e.message));
});
await send('Fetch.enable', { patterns: [{ urlPattern: ADMIN + '/api/*', requestStage: 'Request' }] });

const now = () => Date.now() / 1000;
// Screenshot loop. Paused while a document is loading so the video never shows blank pages:
// the last frame simply holds until the new page and its caption are ready.
// A screenshot requested while a navigation commits can stay unanswered, so navigations wait for the
// in-flight capture and every capture gives up after 3 s.
let recording = false, paused = false, loop = null, inflight = Promise.resolve();
async function captureLoop() {
  while (recording) {
    const t = now();
    if (!paused) {
      inflight = Promise.race([
        send('Page.captureScreenshot', { format: 'jpeg', quality: 88 }),
        sleep(3000).then(() => null),
      ]).catch(() => null);
      const shot = await inflight;
      if (shot && !paused) {
        const file = path.join(framesDir, `f${String(frames.length).padStart(6, '0')}.jpg`);
        writeFileSync(file, Buffer.from(shot.data, 'base64'));
        frames.push({ file, ts: t });
        firstTs ??= t;
      }
    }
    const wait = FRAME_MS - (now() - t) * 1000;
    if (wait > 0) await sleep(wait);
  }
}
const mark = (label) => { marks.push({ label, ts: now() }); console.log(`[${marks.length}] +${(now() - (marks[0]?.ts ?? now())).toFixed(0)}s ${label}`); };

let currentCaption = null;
async function overlay() { await call(pageEnsureOverlay, OVERLAY_CSS); }
async function caption(text, sub, holdMs = 0) {
  currentCaption = text ? [text, sub] : null;
  await overlay();
  await call(pageCaption, text || '', sub || '');
  if (holdMs) await sleep(holdMs);
}
async function card(title, lines, holdMs) {
  await overlay();
  await call(pageCaption, '', '');
  await call(pageCard, title, lines);
  await sleep(holdMs);
  await call(pageCard, '', []);
}
async function go(url, readyExpr) {
  paused = true;
  await inflight;
  await send('Page.navigate', { url });
  await waitFor("document.readyState==='complete'");
  if (readyExpr) await waitFor(readyExpr, 20000);
  await overlay();
  if (currentCaption) await call(pageCaption, currentCaption[0], currentCaption[1] || '');
  await sleep(300);
  paused = false;
}
async function locate(selector, text, scope, timeoutMs = 15000) {
  const end = Date.now() + timeoutMs;
  for (;;) {
    const box = await call(pageLocate, selector, text || '', scope || '');
    if (box) return box;
    if (Date.now() > end) throw new Error(`element not found: ${selector} "${text || ''}"`);
    await sleep(250);
  }
}
async function mouse(type, x, y) {
  await send('Input.dispatchMouseEvent', { type, x, y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
}
async function click(selector, text, scope, { ring = true } = {}) {
  const box = await locate(selector, text, scope);
  await sleep(250); // let scrollIntoView settle
  const b = await locate(selector, text, scope);
  if (ring) await call(pageRing, b, true);
  await call(pageCursor, b.x, b.y, false);
  await mouse('mouseMoved', b.x, b.y);
  await sleep(700);
  await call(pageCursor, b.x, b.y, true);
  await mouse('mousePressed', b.x, b.y);
  await sleep(120);
  await mouse('mouseReleased', b.x, b.y);
  await call(pageCursor, b.x, b.y, false);
  await sleep(250);
  await call(pageRing, box, false);
}
async function type(selector, text, scope, { clear = false, delay = 55 } = {}) {
  await click(selector, '', scope, { ring: false });
  if (clear) await call(pageSetValue, selector, '', scope || '');
  const start = clear ? '' : await call((sel, scope) => ([...document.querySelectorAll(scope || 'body')].pop()?.querySelector(sel)?.value ?? ''), selector, scope || '');
  const chars = [...text];
  for (let i = 1; i <= chars.length; i++) {
    await call(pageSetValue, selector, start + chars.slice(0, i).join(''), scope || '');
    await sleep(delay);
  }
  await sleep(300);
}
async function setField(selector, value, scope) {
  await click(selector, '', scope, { ring: false });
  if (!await call(pageSetValue, selector, value, scope || '')) throw new Error(`cannot set ${selector}`);
  await sleep(600);
}
async function chooseOption(selector, text, scope) {
  await click(selector, '', scope, { ring: false });
  if (!await call(pageSelectByText, selector, text, scope || '')) throw new Error(`option "${text}" missing in ${selector}`);
  await sleep(600);
}
const hasText = (text) => `document.body.innerText.includes(${JSON.stringify(text)})`;
async function expectNotice(text) {
  await waitFor(hasText(text), 15000);
  const errors = await call(pageText, '.notice-error');
  if (errors.trim()) throw new Error(`UI error shown: ${errors.trim()}`);
}

async function formLogin(origin, email, heading) {
  await go(origin + '/login', "!!document.querySelector('form.login-card')");
  await call(() => { localStorage.clear(); return true; });
  await go(origin + '/login', "!!document.querySelector('form.login-card')");
  await waitFor(hasText(heading));
  await waitFor("!document.querySelector('.login-submit').disabled", 20000); // waits for the server health check
  await sleep(1200);
  await type('input[name=email]', email);
  await type('input[name=password]', PASSWORD, null, { delay: 90 });
  const typed = await call((email, pw) => document.querySelector('input[name=email]').value === email
    && document.querySelector('input[name=password]').value === pw, email, PASSWORD);
  if (!typed) throw new Error('login form not filled correctly; not submitting (protects the lockout counter)');
  await click('.login-submit');
  await waitFor("!!document.querySelector('aside.sidebar')", 20000);
  await overlay();
  if (currentCaption) await call(pageCaption, currentCaption[0], currentCaption[1] || '');
}
async function navTo(label, readyExpr) {
  await click('a.nav-link', label);
  if (readyExpr) await waitFor(readyExpr, 15000);
  await waitFor("!document.querySelector('.loading')", 15000);
}
const MODAL = 'section[role=dialog]';

async function run() {
  // 1. Title card (shown before the first frame is captured)
  await go(ADMIN + '/login', "!!document.querySelector('form.login-card')");
  await call(pageCard, 'IMS – Hệ thống quản lý thực tập sinh', []);
  recording = true;
  loop = captureLoop();
  mark('Mở đầu: giới thiệu');
  await card('IMS – Hệ thống quản lý thực tập sinh', ['Demo chạy thật (Spring Boot + MySQL)', 'Ứng dụng Admin/Mentor (cổng 5174) · Ứng dụng Thực tập sinh (cổng 5173)'], 5000);

  // 2. Admin
  mark('Admin đăng nhập');
  await caption('Bước 1 · Quản trị viên đăng nhập ứng dụng Admin / Server', 'Màn hình đăng nhập không hiển thị sẵn tài khoản demo', 2500);
  await formLogin(ADMIN, 'admin@gmail.com', 'Đăng nhập Admin / Mentor');
  mark('Admin: Tổng quan');
  await caption('Trang Tổng quan của Admin: thống kê thực tập sinh, công việc, báo cáo', 'Menu có mục "Quản trị hệ thống" dành riêng cho Admin');
  await waitFor("!document.body.innerText.includes('…')", 10000).catch(() => {});
  await sleep(1500);
  const adminMenu = await locate('a.nav-link', 'Quản trị hệ thống');
  await call(pageRing, adminMenu, true); await sleep(2200); await call(pageRing, adminMenu, false);
  mark('Admin: danh sách Thực tập sinh');
  await caption('Admin xem danh sách thực tập sinh: phòng ban, mentor, thời gian, tiến độ');
  await navTo('Thực tập sinh', hasText('Danh sách hồ sơ'));
  await sleep(3500);
  await caption('Admin đăng xuất để chuyển sang tài khoản Mentor');
  await click('button.logout-btn');
  await waitFor("!!document.querySelector('form.login-card')");
  await overlay(); await call(pageCaption, currentCaption[0], '');
  await sleep(1200);

  // 3. Mentor
  mark('Mentor đăng nhập');
  await caption('Bước 2 · Mentor đăng nhập qua cùng ứng dụng Admin / Server', 'Backend phân quyền theo vai trò MENTOR');
  await formLogin(ADMIN, 'mentor@gmail.com', 'Đăng nhập Admin / Mentor');
  mark('Mentor: Tổng quan (không có menu Quản trị hệ thống)');
  await caption('Dashboard của Mentor: KHÔNG có menu "Quản trị hệ thống"', 'Mentor chỉ thấy thực tập sinh mình hướng dẫn');
  await sleep(1000);
  const nav = await locate('nav.nav-list', '');
  await call(pageRing, nav, true); await sleep(3000); await call(pageRing, nav, false);
  mark('Mentor: giao công việc mới');
  await caption('Mentor mở mục Công việc và giao việc mới cho thực tập sinh Nguyen Van An');
  await navTo('Công việc', hasText('Danh sách công việc'));
  await sleep(1500);
  await click('button.btn-primary', 'Giao công việc');
  await waitFor(`!!document.querySelector('${MODAL}')`);
  await sleep(800);
  await type('input[name=title]', TASK.title, MODAL);
  await chooseOption('select[name=internId]', TASK.intern, MODAL);
  await chooseOption('select[name=priority]', 'Cao', MODAL);
  await caption('Hạn hoàn thành 27/11/2026 – nằm trong thời gian thực tập (01/09/2026 – 30/06/2027)');
  await setField('input[name=deadline]', TASK.deadline, MODAL);
  await type('textarea[name=description]', TASK.description, MODAL, { delay: 35 });
  await sleep(800);
  await click('button[type=submit]', 'Giao công việc', MODAL);
  await expectNotice('Đã giao công việc');
  mark('Mentor: công việc đã được giao');
  await caption('Công việc mới được lưu vào MySQL với trạng thái "Chưa bắt đầu" (TODO)');
  await sleep(1000);
  const newRow = await locate('tbody tr', TASK.title);
  await call(pageRing, newRow, true); await sleep(3000); await call(pageRing, newRow, false);

  // 4. Intern
  mark('Thực tập sinh đăng nhập');
  await caption('Bước 3 · Thực tập sinh đăng nhập ứng dụng Client (cổng 5173)');
  await formLogin(INTERN, 'intern@gmail.com', 'Đăng nhập thực tập sinh');
  await sleep(1500);
  mark('Thực tập sinh: Công việc của tôi');
  await caption('Thực tập sinh thấy công việc vừa được mentor giao');
  await navTo('Công việc của tôi', hasText(TASK.title));
  await sleep(1000);
  const row = 'tbody tr';
  const taskRow = await locate(row, TASK.title);
  await call(pageRing, taskRow, true); await sleep(2500); await call(pageRing, taskRow, false);
  mark('Thực tập sinh: bắt đầu công việc (TODO → IN_PROGRESS)');
  await caption('Bấm "Bắt đầu": chuyển trạng thái TODO → IN_PROGRESS');
  // Click the "Bắt đầu" button of the newest TODO row with this title.
  const taskIndex = await call(pageTagRow, [TASK.title], -1, 'Bắt đầu');
  if (taskIndex < 0) throw new Error('no TODO row for the new task');
  await click('tr[data-demo-row] button', 'Bắt đầu');
  await waitFor(`!!document.querySelector('${MODAL}')`);
  await sleep(800);
  await type('textarea[name=completionNote]', 'Đã đọc yêu cầu, bắt đầu thiết kế endpoint.', MODAL, { delay: 40 });
  await click('button[type=submit]', 'Xác nhận cập nhật', MODAL);
  await expectNotice('Đã cập nhật tiến độ');
  mark('Thực tập sinh: công việc Đang thực hiện');
  await caption('Trạng thái đã chuyển sang "Đang thực hiện" (IN_PROGRESS)');
  await waitFor("!document.querySelector('.loading')");
  await sleep(800);
  if (await call(pageTagRow, [TASK.title], taskIndex, '') < 0) throw new Error('task row disappeared after update');
  const doneBtn = await locate('tr[data-demo-row] button', 'Hoàn thành').catch(() => null);
  const progressRow = await locate('tr[data-demo-row]', '');
  await call(pageRing, progressRow, true); await sleep(3000); await call(pageRing, progressRow, false);
  mark('Quy tắc nghiệp vụ chuyển trạng thái');
  await caption('Quy tắc nghiệp vụ: chỉ được đi TODO → IN_PROGRESS → COMPLETED',
    'Giao diện chỉ hiện bước hợp lệ kế tiếp ("Hoàn thành"); API cũng từ chối chuyển ngược/nhảy cóc (có test tự động)');
  if (doneBtn) { await call(pageRing, doneBtn, true); await sleep(5000); await call(pageRing, doneBtn, false); } else await sleep(5000);

  mark('Thực tập sinh: nộp báo cáo tuần');
  await caption('Thực tập sinh vào Báo cáo tuần và nộp báo cáo mới');
  await navTo('Báo cáo tuần', hasText('Danh sách báo cáo'));
  const week = await call(async (key) => {
    const res = await fetch('/api/reports', { headers: { Authorization: 'Bearer ' + localStorage.getItem(key) } });
    if (!res.ok) return null;
    const used = new Set((await res.json()).map((r) => r.weekNumber));
    let w = 10; while (used.has(w) && w < 53) w++;
    return used.has(w) ? null : w;
  }, 'ims-intern-token');
  if (!week) throw new Error('no free week number for the weekly report');
  await sleep(1500);
  await click('button.btn-primary', 'Nộp báo cáo');
  await waitFor(`!!document.querySelector('${MODAL}')`);
  await sleep(600);
  await caption(`Báo cáo tuần ${week} (số tuần chưa dùng – hệ thống chặn nộp trùng tuần)`);
  await type('input[name=weekNumber]', String(week), MODAL);
  await type('textarea[name=completedWork]', 'Bắt đầu công việc "Viết API báo cáo tuần", thiết kế endpoint.', MODAL, { delay: 30 });
  await type('textarea[name=learned]', 'Spring Boot validation, phân quyền theo vai trò.', MODAL, { delay: 30 });
  await type('textarea[name=problems]', 'Chưa quen viết test tích hợp.', MODAL, { delay: 30 });
  await type('textarea[name=planNextWeek]', 'Hoàn thành API và viết test.', MODAL, { delay: 30 });
  await click('button[type=submit]', 'Nộp báo cáo', MODAL);
  await expectNotice('Đã nộp báo cáo tuần');
  mark('Thực tập sinh: báo cáo Chờ đánh giá');
  await caption(`Báo cáo tuần ${week} đã nộp – trạng thái "Chờ đánh giá" (SUBMITTED)`);
  await sleep(800);
  const reportRow = await locate('tbody tr', `Tuần ${week}`);
  await call(pageRing, reportRow, true); await sleep(3000); await call(pageRing, reportRow, false);

  // 5. Mentor reviews
  mark('Mentor chấm báo cáo');
  await caption('Bước 4 · Mentor quay lại ứng dụng Admin (phiên đăng nhập vẫn còn) để chấm báo cáo');
  await go(ADMIN + '/dashboard', "!!document.querySelector('aside.sidebar')");
  await sleep(2500);
  await navTo('Báo cáo tuần', hasText(`Tuần ${week}`));
  await sleep(1200);
  const reportKey = [`Tuần ${week}`, TASK.intern];
  if (await call(pageTagRow, reportKey, -1, 'Chấm điểm') < 0) throw new Error(`report week ${week} not listed for mentor`);
  await click('tr[data-demo-row] button', 'Chấm điểm');
  await waitFor(`!!document.querySelector('${MODAL}')`);
  await sleep(800);
  await caption('Mentor cho điểm 9/10 và viết nhận xét');
  await type('input[name=rating]', '9', MODAL, { clear: true });
  await type('textarea[name=mentorComment]', 'Báo cáo rõ ràng, tiến độ tốt. Tiếp tục bổ sung test.', MODAL, { delay: 35 });
  await click('button[type=submit]', 'Lưu đánh giá', MODAL);
  await expectNotice('Đã chấm và nhận xét báo cáo');
  mark('Mentor: báo cáo Đã đánh giá');
  await caption('Báo cáo chuyển sang "Đã đánh giá" (REVIEWED) với điểm 9.0/10');
  await waitFor("!document.querySelector('.loading')");
  await sleep(800);
  if (await call(pageTagRow, reportKey, -1, 'Chấm điểm') < 0) throw new Error('report row disappeared after review');
  const reviewed = await locate('tr[data-demo-row]', '');
  await call(pageRing, reviewed, true); await sleep(3500); await call(pageRing, reviewed, false);

  // 6. Closing card
  mark('Kết thúc');
  await card('Đội AI Agent (AgentKit)', ['19 test tự động', 'CI GitHub Actions xanh', 'Không còn lỗi High về phân quyền'], 5500);
  await sleep(300);
}

function encode(endTs) {
  if (frames.length < 2) throw new Error('no frames were captured');
  const lines = ['ffconcat version 1.0'];
  frames.forEach((f, i) => {
    const next = i + 1 < frames.length ? frames[i + 1].ts : endTs;
    const dur = Math.max(1 / FPS, next - f.ts);
    lines.push(`file '${f.file.replace(/\\/g, '/')}'`, `duration ${dur.toFixed(4)}`);
  });
  lines.push(`file '${frames.at(-1).file.replace(/\\/g, '/')}'`);
  const list = path.join(framesDir, 'frames.ffconcat');
  writeFileSync(list, lines.join('\n'));
  mkdirSync(path.dirname(OUT), { recursive: true });
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-vf', `fps=${FPS},scale=${W}:${H}:flags=lanczos:out_range=tv,format=yuv420p`, '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-c:v', 'libx264', '-preset', 'slow', '-crf', '20',
    '-movflags', '+faststart', '-an', OUT], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error(`ffmpeg failed (exit ${r.status})`);
}

let ok = false;
try {
  await run();
  ok = true;
} catch (e) {
  console.error('Recording failed:', e.message);
  const shot = await send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
  if (shot) { writeFileSync(path.join(framesDir, 'error.png'), Buffer.from(shot.data, 'base64')); console.error('screenshot: ' + path.join(framesDir, 'error.png')); }
  process.exitCode = 1;
} finally {
  recording = false;
  await loop?.catch(() => {});
  page.close();
}
if (ok) {
  const endTs = Math.max(now(), (frames.at(-1)?.ts ?? 0) + 1);
  encode(endTs);
  const base = firstTs ?? marks[0].ts;
  console.log(`\nwrote ${OUT} (${(statSync(OUT).size / 1048576).toFixed(1)} MB, ${frames.length} frames, ~${(endTs - base).toFixed(1)} s)`);
  console.log('Chapters:');
  for (const m of marks) {
    const t = Math.max(0, m.ts - base);
    console.log(`  ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}  ${m.label}`);
  }
}
if (!process.env.FRAMES_DIR) rmSync(framesDir, { recursive: true, force: true });
