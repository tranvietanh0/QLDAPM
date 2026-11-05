// Part A of the demo video: capture REAL terminal sessions of the AI agent team, then replay them in a
// terminal-styled page recorded with headless Edge (same frame pipeline as record_demo_video.mjs).
//
//   node src/record_agent_demo.mjs capture <pre|post|ci>   run real commands, save stdout with per-line timings
//   node src/record_agent_demo.mjs claude                  run the nested headless Claude Code session (stream-json)
//   node src/record_agent_demo.mjs record [out.mp4]        replay the captured sessions and encode the MP4
//
// Captures go to docs/video/agent_capture/ (personal e-mail addresses and the demo password are masked before
// anything is written). The replay only shows lines that exist in those captures; long waits are compressed and
// labelled "×N". Override ffmpeg with FFMPEG, keep frames with FRAMES_DIR, and the raw Claude stream directory
// with RAW_DIR (defaults to the OS temp dir).
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync, createWriteStream } from 'node:fs';
import { tmpdir, homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRecorder, openPage, sleep } from './cdp_browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CAPTURE_DIR = path.join(ROOT, 'docs', 'video', 'agent_capture');
const FFMPEG = process.env.FFMPEG
  || 'C:/Users/tranv/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const MAVEN_BIN = path.join(homedir(), '.m2', 'wrapper', 'dists', 'apache-maven-3.9.9', '3477a4f1', 'bin');
const W = 1440, H = 900, FPS = 25;

// ---------- redaction (applied to everything written to the repo) ----------
const PUBLIC_EMAILS = new Set(['admin@gmail.com', 'mentor@gmail.com', 'intern@gmail.com', 'noreply@anthropic.com']);
function redact(text) {
  let out = String(text).replace(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g,
    (m) => (PUBLIC_EMAILS.has(m.toLowerCase()) || /@\d/.test(m) ? m : '[email đã ẩn]'));
  const pw = process.env.IMS_DEMO_PASSWORD;
  if (pw && pw.length >= 4) out = out.split(pw).join('***');
  return out;
}
// Strip ANSI colour/cursor sequences so the replay shows plain text.
const stripAnsi = (s) => s.replace(/\u001b\[[0-9;?]*[ -/]*[@-~]/g, '').replace(/\r/g, '');

function withPath(extraBin) {
  const env = { ...process.env, NO_COLOR: '1', FORCE_COLOR: '0', COLUMNS: '120', TERM: 'dumb' };
  const key = Object.keys(env).find((k) => k.toLowerCase() === 'path') || 'PATH';
  env[key] = extraBin + path.delimiter + (env[key] || '');
  return env;
}

// Run one command through Git Bash and record each output line with its arrival time (ms from start).
function runTimed(cmd) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const lines = [];
    const child = spawn('bash', ['-c', cmd], { cwd: ROOT, env: withPath(MAVEN_BIN.replace(/\\/g, '/')), stdio: ['ignore', 'pipe', 'pipe'] });
    const reader = (stream) => {
      let buf = '';
      stream.setEncoding('utf8');
      stream.on('data', (chunk) => {
        buf += chunk;
        let i;
        while ((i = buf.indexOf('\n')) >= 0) {
          lines.push({ t: Date.now() - start, text: redact(stripAnsi(buf.slice(0, i))) });
          buf = buf.slice(i + 1);
        }
      });
      stream.on('end', () => { if (buf) lines.push({ t: Date.now() - start, text: redact(stripAnsi(buf)) }); });
    };
    reader(child.stdout); reader(child.stderr);
    child.on('error', reject);
    child.on('close', (code) => resolve({ cmd, startedAt: new Date(start).toISOString(), durationMs: Date.now() - start, exitCode: code, lines }));
  });
}

const CAPTURE_SETS = {
  pre: ['ak --version', 'ak doctor', 'ls .claude/agents', 'head -n 7 .claude/agents/tester.md', 'ls plans/reports'],
  // The committed (pre-fix) CORS default, shown before the agent run.
  head: ['git show HEAD:app/backend/src/main/resources/application.properties | grep -n "app.cors.origins"'],
  post: ['git status --short', 'git diff -- app/backend', 'ls plans/reports'],
  // Independent re-run of the backend suite (verify also writes the JaCoCo report read by the closing card).
  verify: ['set -o pipefail; mvn -o -B -Djava.version=17 -f app/backend/pom.xml verify | grep -E "Tests run:|BUILD|Total time"'],
  // The second command is filled in with the id of the newest run listed by the first one.
  ci: ['gh run list --limit 3', (prev) => {
    const id = prev[0].lines.map((l) => l.text.split('\t')[6]).find((v) => /^\d+$/.test(v || ''));
    if (!id) throw new Error('could not read a run id from gh run list');
    return `gh run view ${id}`;
  }],
};

async function capture(set) {
  const cmds = CAPTURE_SETS[set];
  if (!cmds) throw new Error(`unknown capture set "${set}" (use ${Object.keys(CAPTURE_SETS).join('|')})`);
  mkdirSync(CAPTURE_DIR, { recursive: true });
  const scenes = [];
  for (const entry of cmds) {
    const cmd = typeof entry === 'function' ? entry(scenes) : entry;
    const r = await runTimed(cmd);
    console.log(`$ ${cmd}  -> exit ${r.exitCode}, ${r.lines.length} lines, ${r.durationMs} ms`);
    if (r.exitCode !== 0) throw new Error(`command failed (exit ${r.exitCode}): ${cmd}\n${r.lines.map((l) => l.text).join('\n')}`);
    scenes.push(r);
  }
  const file = path.join(CAPTURE_DIR, `terminal-${set}.json`);
  writeFileSync(file, JSON.stringify({ capturedAt: new Date().toISOString(), cwd: 'C:/Projects/Study/QLDAPM/QLDAPM', scenes }, null, 1));
  console.log(`wrote ${file}`);
}

// ---------- nested headless Claude Code run ----------
export const CLAUDE_PROMPT = [
  'Sửa một lỗi thật trong dự án IMS: cổng Admin chạy dev ở http://localhost:5174 (Vite) bị HTTP 403 với mọi yêu cầu POST/PUT,',
  'vì danh sách CORS mặc định của backend (app.cors.origins, đọc bởi CorsConfig.java) chỉ có cổng 5173.',
  'Hãy điều phối đội agent theo đúng thứ tự sau, mỗi bước dùng đúng một subagent:',
  '1) Agent fullstack-developer: thêm http://localhost:5174 và http://127.0.0.1:5174 vào giá trị CORS mặc định ở',
  'app/backend/src/main/resources/application.properties (dòng app.cors.origins) và vào dòng chú thích CORS_ORIGINS trong',
  'app/backend/.env.example. Giữ nguyên hai origin 5173 hiện có. Không sửa file mã nguồn nào khác (CorsConfig.java chỉ đọc để hiểu).',
  '2) Sau đó agent tester: chạy đúng lệnh `mvn -o -B -Djava.version=17 -f app/backend/pom.xml test` từ thư mục gốc repo',
  `(Maven 3.9.9 ở ${MAVEN_BIN.replace(/\\/g, '/')}/mvn, đã có trên PATH với tên mvn; chạy offline) và báo số test chạy/thất bại.`,
  '3) Cuối cùng agent code-reviewer: review `git diff` của thay đổi (chỉ đọc, không sửa code).',
  'Mỗi agent ghi một báo cáo ngắn bằng tiếng Việt vào plans/reports/ (tên file có đuôi -cors-5174.md)',
  'và kết thúc câu trả lời bằng một dòng `Status: DONE | DONE_WITH_CONCERNS | BLOCKED`.',
  'Không commit, không chạy lệnh git nào ngoài git diff/git status. Cuối cùng tóm tắt kết quả bằng tiếng Việt.',
].join(' ');
export const CLAUDE_ALLOWED = 'Read,Grep,Glob,Edit,Write,Agent,Task,Bash(mvn:*),Bash(git diff:*),Bash(git status:*),Bash(ls:*)';
export const CLAUDE_ARGS = ['-p', CLAUDE_PROMPT, '--output-format', 'stream-json', '--verbose',
  '--permission-mode', 'acceptEdits', '--allowedTools', CLAUDE_ALLOWED];

async function runClaude() {
  mkdirSync(CAPTURE_DIR, { recursive: true });
  const rawDir = process.env.RAW_DIR ? path.resolve(process.env.RAW_DIR) : tmpdir();
  mkdirSync(rawDir, { recursive: true });
  const rawFile = path.join(rawDir, 'claude-stream-raw.jsonl');
  const outFile = path.join(CAPTURE_DIR, 'claude-stream.jsonl');
  const raw = createWriteStream(rawFile);
  const red = createWriteStream(outFile);
  const exe = process.env.CLAUDE_BIN || path.join(homedir(), '.local', 'bin', 'claude.exe');
  if (!existsSync(exe)) throw new Error(`claude not found at ${exe} (set CLAUDE_BIN)`);
  const start = Date.now();
  const meta = { kind: 'meta', startedAt: new Date(start).toISOString(), cwd: 'C:/Projects/Study/QLDAPM/QLDAPM', args: CLAUDE_ARGS };
  raw.write(JSON.stringify(meta) + '\n'); red.write(redact(JSON.stringify(meta)) + '\n');
  const child = spawn(exe, CLAUDE_ARGS, { cwd: ROOT, env: withPath(MAVEN_BIN), stdio: ['ignore', 'pipe', 'pipe'] });
  const killer = setTimeout(() => { console.error('claude run exceeded 45 min, stopping it'); child.kill(); }, 45 * 60 * 1000);
  const pipeLines = (stream, kind) => {
    let buf = '';
    stream.setEncoding('utf8');
    const flush = (line) => {
      if (!line.trim()) return;
      const t = Date.now() - start;
      let ev; try { ev = JSON.parse(line); } catch { ev = { type: kind, text: line }; }
      const rec = JSON.stringify({ t, ev });
      raw.write(rec + '\n'); red.write(redact(rec) + '\n');
      if (ev.type === 'assistant') {
        for (const c of ev.message?.content || []) {
          if (c.type === 'tool_use') console.log(`+${(t / 1000).toFixed(0)}s ${ev.parent_tool_use_id ? '  [sub]' : ''} tool ${c.name} ${JSON.stringify(c.input).slice(0, 140)}`);
          if (c.type === 'text') console.log(`+${(t / 1000).toFixed(0)}s ${ev.parent_tool_use_id ? '  [sub]' : ''} text ${c.text.slice(0, 140).replace(/\n/g, ' ')}`);
        }
      } else if (ev.type === 'result') console.log(`+${(t / 1000).toFixed(0)}s result ${ev.subtype} is_error=${ev.is_error}`);
      else if (kind === 'stderr') console.error(`stderr: ${line.slice(0, 300)}`);
    };
    stream.on('data', (chunk) => { buf += chunk; let i; while ((i = buf.indexOf('\n')) >= 0) { flush(buf.slice(0, i)); buf = buf.slice(i + 1); } });
    stream.on('end', () => flush(buf));
  };
  pipeLines(child.stdout, 'stdout'); pipeLines(child.stderr, 'stderr');
  const code = await new Promise((res, rej) => { child.on('error', rej); child.on('close', res); });
  clearTimeout(killer);
  await Promise.all([new Promise((r) => raw.end(r)), new Promise((r) => red.end(r))]);
  console.log(`claude exited ${code} after ${((Date.now() - start) / 1000).toFixed(0)} s\nraw: ${rawFile}\nredacted: ${outFile}`);
  if (code !== 0) process.exitCode = 1;
}

// ---------- replay page ----------
const PAGE_HTML = String.raw`<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>
*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden;background:radial-gradient(circle at 20% 0%,#1e293b,#0b1120 70%);
  font-family:'Segoe UI',Arial,sans-serif;color:#e2e8f0}
#hdr{position:fixed;left:0;right:0;top:0;height:62px;display:flex;align-items:center;gap:16px;padding:0 26px;z-index:5;
  background:rgba(2,6,23,.75);border-bottom:1px solid #1e293b}
#chap{background:linear-gradient(90deg,#4f46e5,#0d9488);padding:7px 16px;border-radius:999px;font-weight:700;font-size:19px}
#scene{font-size:19px;color:#cbd5e1;flex:1;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#replay{font-size:16px;color:#fde68a;border:1.5px solid #f59e0b;border-radius:8px;padding:5px 12px;background:rgba(245,158,11,.12);font-weight:600}
#clock{font:600 16px 'Cascadia Mono',Consolas,monospace;color:#94a3b8;min-width:170px;text-align:right}
#ff{position:fixed;right:34px;bottom:150px;z-index:6;font:800 40px 'Segoe UI';color:#0b1120;background:#facc15;padding:6px 22px;border-radius:14px;
  box-shadow:0 8px 30px rgba(250,204,21,.45);opacity:0;transform:scale(.8);transition:opacity .25s,transform .25s}
#ff.on{opacity:1;transform:scale(1)} #ff small{display:block;font-size:15px;font-weight:600;text-align:center;margin-top:-4px}
#wait{position:fixed;left:50%;top:84px;transform:translateX(-50%);z-index:6;font:600 18px 'Segoe UI';color:#e2e8f0;background:rgba(30,41,59,.95);
  border:1px solid #475569;padding:8px 18px;border-radius:10px;opacity:0;transition:opacity .25s;max-width:860px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#wait.on{opacity:1}
#viewport{position:fixed;left:0;right:0;top:62px;bottom:0;overflow:hidden}
#main{position:absolute;inset:18px 24px 128px 24px;display:flex;gap:18px;transition:transform .9s cubic-bezier(.4,0,.2,1)}
.win{flex:1;min-width:0;display:flex;flex-direction:column;background:#0d1117;border:1px solid #30363d;border-radius:12px;box-shadow:0 20px 50px rgba(0,0,0,.5);overflow:hidden}
.bar{height:36px;flex:none;display:flex;align-items:center;gap:8px;padding:0 14px;background:#161b22;border-bottom:1px solid #30363d;font-size:14px;color:#8b949e}
.bar i{width:12px;height:12px;border-radius:50%;display:inline-block}.bar span{margin-left:10px}
#term{flex:1;overflow:hidden;padding:12px 18px;font:15.5px/1.5 'Cascadia Mono',Consolas,monospace;color:#c9d1d9}
.l{white-space:pre-wrap;word-break:break-all;min-height:1.5em;border-radius:4px}
.p .u{color:#3fb950}.p .d{color:#d29922}.p .c{color:#f0f6fc}.caret{display:inline-block;width:9px;height:1.1em;background:#c9d1d9;vertical-align:-3px;animation:b 1s steps(1) infinite}
@keyframes b{50%{opacity:0}}
.dim{color:#8b949e}.ok{color:#3fb950}.warn{color:#d29922}.err{color:#f85149}.add{color:#3fb950;background:rgba(46,160,67,.15)}.del{color:#f85149;background:rgba(248,81,73,.12)}
.hunk{color:#79c0ff}.main{color:#f0f6fc}.ev{color:#6e7681}.st{font-weight:700;color:#facc15}
.spawn{background:rgba(99,102,241,.18);border-left:4px solid var(--ac,#818cf8);padding-left:8px;color:#f0f6fc;font-weight:700}
.sub{padding-left:2.2em}.tag{font-weight:700;color:var(--ac)}
.hl{outline:2px solid #f59e0b;box-shadow:0 0 0 5px rgba(245,158,11,.25)}
#panel{width:390px;flex:none;display:none;flex-direction:column;gap:12px}
#panel h3{margin:4px 0 2px;font-size:19px;color:#f8fafc}
.card{background:#111827;border:1px solid #334155;border-left:6px solid var(--ac);border-radius:12px;padding:12px 14px;transition:box-shadow .3s,opacity .3s;opacity:.55}
.card.act{opacity:1;box-shadow:0 0 0 2px var(--ac),0 10px 30px rgba(0,0,0,.4)}.card.done{opacity:1}
.card b{font-size:19px;color:var(--ac)}.card .m{float:right;font:13px 'Cascadia Mono',monospace;color:#94a3b8;margin-top:4px}
.card .ds{font-size:15px;color:#cbd5e1;margin:4px 0 6px}.card .s{font:600 15px 'Cascadia Mono',Consolas,monospace;color:#94a3b8}
.card .s.fin{color:#facc15}
#cap{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:7;width:max-content;max-width:1300px;padding:14px 30px;border-radius:14px;
  background:rgba(15,23,42,.92);border:1px solid #334155;color:#fff;font:600 26px/1.4 'Segoe UI',Arial,sans-serif;text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.4)}
#cap:empty{display:none}#cap small{display:block;font-size:18px;font-weight:400;color:#cbd5e1;margin-top:3px}
#cur{position:fixed;left:720px;top:450px;width:26px;height:26px;margin:-13px 0 0 -13px;border-radius:50%;z-index:9;display:none;
  background:rgba(239,68,68,.35);border:3px solid #ef4444;pointer-events:none;transition:left .7s ease,top .7s ease,transform .15s}
#cur.down{transform:scale(.6);background:rgba(239,68,68,.75)}
#cur::after{content:'';position:absolute;inset:-14px;border-radius:50%;border:3px solid #ef4444;opacity:0}
#cur.down::after{animation:ripple .5s ease-out}@keyframes ripple{from{opacity:.9;transform:scale(.4)}to{opacity:0;transform:scale(1.4)}}
#viewer{position:fixed;inset:86px 120px 140px 120px;z-index:8;display:none;flex-direction:column}
#viewer .win{box-shadow:0 30px 80px rgba(0,0,0,.7)}#vbody{flex:1;overflow:hidden;padding:16px 22px;font:15.5px/1.55 'Cascadia Mono',Consolas,monospace;color:#c9d1d9;white-space:pre-wrap}
#vbody .h{color:#79c0ff;font-weight:700}#vbody .st{color:#facc15}
#slide{position:absolute;inset:18px 24px 128px 24px;display:none;flex-direction:column;align-items:center;justify-content:center;gap:26px}
.flow{display:flex;align-items:center;gap:14px}.node{background:#111827;border:2px solid var(--ac);border-radius:14px;padding:14px 18px;min-width:190px;text-align:center;
  opacity:0;transform:translateY(12px);transition:opacity .5s,transform .5s}.node.on{opacity:1;transform:none}
.node b{display:block;color:var(--ac);font-size:21px}.node span{font-size:15px;color:#cbd5e1}.arr{font-size:30px;color:#64748b}
.lead{font-size:24px;color:#e2e8f0;text-align:center;max-width:1150px;line-height:1.5}
</style></head><body>
<div id="hdr"><div id="chap"></div><div id="scene"></div><div id="replay">Phát lại phiên chạy thật (đã tua nhanh)</div><div id="clock"></div></div>
<div id="ff"></div><div id="wait"></div>
<div id="viewport"><div id="main"><div class="win"><div class="bar"><i style="background:#ff5f56"></i><i style="background:#ffbd2e"></i><i style="background:#27c93f"></i>
<span id="wtitle">Git Bash — C:/Projects/Study/QLDAPM/QLDAPM</span></div><div id="term"></div></div><div id="panel"><h3>Đội agent trong phiên chạy</h3></div></div>
<div id="slide"></div></div>
<div id="viewer"><div class="win"><div class="bar"><i style="background:#ff5f56"></i><i style="background:#ffbd2e"></i><i style="background:#27c93f"></i><span id="vtitle"></span></div><div id="vbody"></div></div></div>
<div id="cap"></div><div id="cur"></div>
<script>
const $ = (id) => document.getElementById(id);
let seq = 0;
window.R = {
  header(chap, scene) { $('chap').textContent = chap; $('scene').textContent = scene; return true; },
  clock(text) { $('clock').textContent = text || ''; return true; },
  caption(text, sub) { const c = $('cap'); c.textContent = text || ''; if (sub) { const s = document.createElement('small'); s.textContent = sub; c.appendChild(s); } return true; },
  ff(n, sub) { const f = $('ff'); if (!n) { f.classList.remove('on'); return true; } f.innerHTML = ''; f.append('×' + n); const s = document.createElement('small'); s.textContent = sub || 'tua nhanh'; f.appendChild(s); f.classList.add('on'); return true; },
  wait(text) { const w = $('wait'); w.textContent = text || ''; w.classList.toggle('on', !!text); return true; },
  clear() { $('term').innerHTML = ''; return true; },
  title(t) { $('wtitle').textContent = t; return true; },
  scroll() { const t = $('term'); t.scrollTop = t.scrollHeight; },
  prompt(cmd, caret) {
    let p = document.querySelector('.p.live');
    if (!p) { p = document.createElement('div'); p.className = 'l p live'; p.dataset.id = ++seq; $('term').appendChild(p); }
    p.innerHTML = '<span class="u">tranv@ims</span> <span class="d">MINGW64 ~/QLDAPM</span>\n<span class="c">$ </span>';
    const c = document.createElement('span'); c.className = 'c'; c.textContent = cmd; p.appendChild(c);
    if (caret) { const k = document.createElement('span'); k.className = 'caret'; p.appendChild(k); } else p.classList.remove('live');
    this.scroll(); return Number(p.dataset.id);
  },
  // segs: [[text, cls]] or a single string; opts.cls applies to the whole line, opts.ac sets the agent colour.
  line(segs, opts = {}) {
    const d = document.createElement('div'); d.className = 'l ' + (opts.cls || ''); d.dataset.id = ++seq;
    if (opts.ac) d.style.setProperty('--ac', opts.ac);
    for (const [text, cls] of (typeof segs === 'string' ? [[segs, '']] : segs)) { const s = document.createElement('span'); if (cls) s.className = cls; s.textContent = text; d.appendChild(s); }
    $('term').appendChild(d); this.scroll(); return seq;
  },
  find(text) { const el = [...document.querySelectorAll('#term .l')].reverse().find((e) => e.textContent.includes(text)); return el ? Number(el.dataset.id) : 0; },
  mark(id, on) { const el = document.querySelector('[data-id="' + id + '"]'); el?.classList.toggle('hl', !!on); return !!el; },
  panel(show) { $('panel').style.display = show ? 'flex' : 'none'; return true; },
  card(id, d) {
    let c = document.getElementById('card-' + id);
    if (!c) { c = document.createElement('div'); c.id = 'card-' + id; c.className = 'card'; c.innerHTML = '<span class="m"></span><b></b><div class="ds"></div><div class="s"></div>'; $('panel').appendChild(c); }
    c.style.setProperty('--ac', d.ac);
    c.querySelector('b').textContent = d.agent; c.querySelector('.m').textContent = d.model || '';
    c.querySelector('.ds').textContent = d.desc; const s = c.querySelector('.s'); s.textContent = d.state; s.classList.toggle('fin', !!d.fin);
    document.querySelectorAll('.card').forEach((e) => e.classList.remove('act'));
    if (d.active) c.classList.add('act'); if (d.fin) c.classList.add('done');
    return true;
  },
  slide(html) { const s = $('slide'); if (!html) { s.style.display = 'none'; $('main').style.display = 'flex'; return true; } s.innerHTML = html; s.style.display = 'flex'; $('main').style.display = 'none'; return true; },
  slideStep(i) { document.querySelectorAll('#slide .node')[i]?.classList.add('on'); return true; },
  box(sel) { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, l: r.left, t: r.top, w: r.width, h: r.height }; },
  // Gentle zoom: magnify #main around the element and pull it towards the centre of the viewport.
  zoom(sel, s) {
    const m = $('main'), vp = $('viewport').getBoundingClientRect();
    if (!sel) { m.style.transform = 'none'; return true; }
    const el = document.querySelector(sel); if (!el) return false;
    const prev = m.style.transform; m.style.transition = 'none'; m.style.transform = 'none';
    const mr = m.getBoundingClientRect();
    // Terminal lines are full-width blocks: zoom on the text itself, not the empty rest of the row.
    let r = el.getBoundingClientRect();
    if (el.classList.contains('l')) { const rg = document.createRange(); rg.selectNodeContents(el); const rr = [...rg.getClientRects()];
      if (rr.length) { const l = Math.min(...rr.map((x) => x.left)), t = Math.min(...rr.map((x) => x.top)), rt = Math.max(...rr.map((x) => x.right)), b = Math.max(...rr.map((x) => x.bottom)); r = { left: l, top: t, width: rt - l, height: b - t }; } }
    m.style.transform = prev; m.getBoundingClientRect(); m.style.transition = '';
    s = Math.max(1.08, Math.min(s, (vp.width - 100) / r.width, (vp.height - 230) / r.height));
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const ox = cx - mr.left, oy = cy - mr.top;
    // Keep the scaled window covering the viewport edges instead of sliding off-screen.
    const left0 = cx + s * (mr.left - cx), right0 = cx + s * (mr.right - cx);
    const tx = Math.min(vp.left + 24 - left0, Math.max(vp.right - 24 - right0, vp.left + vp.width / 2 - cx));
    const ty = (vp.top + (vp.height - 120) / 2) - cy;
    m.style.transformOrigin = ox + 'px ' + oy + 'px'; m.style.transform = 'translate(' + tx + 'px,' + ty + 'px) scale(' + s + ')';
    return true;
  },
  cursor(x, y, down, show = true) { const c = $('cur'); c.style.display = show ? 'block' : 'none'; c.style.left = x + 'px'; c.style.top = y + 'px'; c.classList.toggle('down', !!down); return true; },
  viewer(title, text) {
    const v = $('viewer'); if (!title) { v.style.display = 'none'; return true; }
    $('vtitle').textContent = title; const b = $('vbody'); b.innerHTML = ''; b.scrollTop = 0;
    for (const line of text.split('\n')) { const d = document.createElement('div'); d.textContent = line || ' ';
      if (/^#/.test(line)) d.className = 'h'; if (/Status:|Trạng thái:/.test(line)) d.className = 'st'; b.appendChild(d); }
    v.style.display = 'flex'; return true;
  },
  vscroll(px) { const b = $('vbody'); b.scrollTo({ top: b.scrollTop + px, behavior: 'smooth' }); return b.scrollTop + b.clientHeight < b.scrollHeight; },
};
</script></body></html>`;

const AGENT_COLORS = { 'fullstack-developer': '#60a5fa', tester: '#34d399', 'code-reviewer': '#c084fc' };
const agentColor = (a) => AGENT_COLORS[a] || '#f472b6';
const rel = (p) => String(p || '').replace(/\\/g, '/').replace(/^C:\/Projects\/Study\/QLDAPM\/QLDAPM\//i, '');
const fmtClock = (ms) => `${String(Math.floor(ms / 60000)).padStart(2, '0')}:${String(Math.floor(ms / 1000) % 60).padStart(2, '0')}`;
const fmtDur = (ms) => { const s = Math.round(ms / 1000); return s >= 60 ? `${Math.floor(s / 60)} phút ${s % 60} giây` : `${s} giây`; };
const readJson = (f) => JSON.parse(readFileSync(path.join(CAPTURE_DIR, f), 'utf8'));
const textOf = (content) => (typeof content === 'string' ? content : (content || []).filter((c) => c.type === 'text').map((c) => c.text).join('\n'));
const statusLine = (text) => (String(text).match(/Status:\s*\*{0,2}\s*(DONE_WITH_CONCERNS|DONE|BLOCKED|NEEDS_CONTEXT)/) || [])[0]?.replace(/\*/g, '') || null;

// Wrap to the terminal width so long values count as several display lines.
function clip(text, maxLines) {
  const lines = String(text).replace(/\r/g, '').split('\n');
  if (lines.length <= maxLines) return { lines, more: 0 };
  return { lines: lines.slice(0, maxLines), more: lines.length - maxLines };
}
function toolLabel(name, input = {}) {
  switch (name) {
    case 'Read': return `Read(${rel(input.file_path)})`;
    case 'Write': return `Write(${rel(input.file_path)})`;
    case 'Edit': return `Edit(${rel(input.file_path)})`;
    case 'Glob': return `Glob(${input.pattern})`;
    case 'Grep': return `Grep("${input.pattern}"${input.path ? ', ' + rel(input.path) : ''})`;
    case 'Bash': return `Bash(${input.command})`;
    default: return `${name}(${JSON.stringify(input).slice(0, 100)})`;
  }
}

/**
 * Turn the captured stream-json events into replay items. Every item is derived from one real event: assistant
 * text, a tool call and its input, a tool result, a permission decision or the final result. Long values are cut
 * with an explicit "… +N dòng" marker; nothing is invented.
 */
function buildClaudeItems(records) {
  const items = [];
  const agents = new Map(); // Agent tool_use id -> { agent, desc, start, model }
  const pendingTools = new Map(); // tool_use id -> label
  const agentIds = new Map(); // subagent agent_id -> subagent_type (permission events only carry agent_id)
  for (const { ev } of records) if (ev.agent_id && ev.subagent_type) agentIds.set(ev.agent_id, ev.subagent_type);
  for (const { t, ev } of records) {
    if (ev.type === 'system' && ev.subtype === 'init') {
      items.push({ t, kind: 'init', lines: [[[`[system/init] `, 'ev'], [`model=${ev.model} permissionMode=${ev.permissionMode} claude_code_version=${ev.claude_code_version} agents=${(ev.agents || []).length} tools=${(ev.tools || []).length}`, 'dim']]] });
    } else if (ev.type === 'system' && ev.subtype === 'permission_denied') {
      items.push({ t, kind: 'deny', sub: !!ev.agent_id, agent: agentIds.get(ev.agent_id), raw: ev });
    } else if (ev.type === 'assistant') {
      const parent = ev.parent_tool_use_id;
      const owner = parent ? agents.get(parent) : null;
      if (owner && !owner.model && ev.message?.model) { owner.model = ev.message.model; items.push({ t, kind: 'model', id: parent, model: ev.message.model }); }
      for (const c of ev.message?.content || []) {
        if (c.type === 'text' && c.text.trim()) items.push({ t, kind: 'text', sub: !!parent, agent: owner?.agent, text: c.text.trim() });
        if (c.type !== 'tool_use') continue;
        if (c.name === 'Agent' || c.name === 'Task') {
          const a = { agent: c.input.subagent_type || 'general-purpose', desc: c.input.description || '', start: t, model: null };
          agents.set(c.id, a);
          items.push({ t, kind: 'spawn', id: c.id, ...a, prompt: c.input.prompt || '' });
        } else {
          pendingTools.set(c.id, toolLabel(c.name, c.input));
          items.push({ t, kind: 'tool', sub: !!parent, agent: owner?.agent, name: c.name, input: c.input, label: toolLabel(c.name, c.input) });
        }
      }
    } else if (ev.type === 'user') {
      const parent = ev.parent_tool_use_id;
      const owner = parent ? agents.get(parent) : null;
      for (const c of ev.message?.content || []) {
        if (c.type !== 'tool_result') continue;
        const text = textOf(c.content);
        if (agents.has(c.tool_use_id)) {
          const a = agents.get(c.tool_use_id);
          items.push({ t, kind: 'agentDone', id: c.tool_use_id, ...a, text, status: statusLine(text), ms: t - a.start, isError: !!c.is_error });
        } else {
          items.push({ t, kind: 'result', sub: !!parent, agent: owner?.agent, text, isError: !!c.is_error, label: pendingTools.get(c.tool_use_id) });
        }
      }
    } else if (ev.type === 'result') {
      items.push({ t, kind: 'final', ev });
    }
  }
  return items;
}

async function record(outArg) {
  if (!existsSync(FFMPEG)) throw new Error(`ffmpeg not found at ${FFMPEG} (set FFMPEG)`);
  const outDir = outArg ? path.resolve(outArg) : path.join(ROOT, 'docs', 'video');
  const pre = readJson('terminal-pre.json'), head = readJson('terminal-head.json'), post = readJson('terminal-post.json');
  const verify = readJson('terminal-verify.json'), ci = readJson('terminal-ci.json');
  const records = readFileSync(path.join(CAPTURE_DIR, 'claude-stream.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).filter((r) => r.ev);
  const items = buildClaudeItems(records);

  const htmlDir = mkdtempSync(path.join(tmpdir(), 'ims-agent-page-'));
  const htmlFile = path.join(htmlDir, 'replay.html');
  writeFileSync(htmlFile, PAGE_HTML);
  const page = await openPage({ port: 9335, width: W, height: H });
  const ui = (fn, ...args) => page.evaluate(`R.${fn}(...${JSON.stringify(args)})`);
  const chapters = [];
  const active = new Set(); // recorders still capturing; stopped on failure so the process can exit
  try {
    await page.send('Page.navigate', { url: 'file:///' + htmlFile.replace(/\\/g, '/') });
    await page.waitFor("!!window.R && document.readyState==='complete'");
    await page.evaluate('document.fonts.ready.then(() => true)');

    // ---- shared scene helpers ----
    let cur = { x: 1200, y: 760 };
    async function moveCursor(x, y) { await ui('cursor', x, y, false); cur = { x, y }; await sleep(800); }
    async function clickAt(x, y) { await moveCursor(x, y); await ui('cursor', x, y, true); await sleep(220); await ui('cursor', x, y, false); await sleep(350); }
    async function hideCursor() { await ui('cursor', cur.x, cur.y, false, false); }
    async function typeCmd(cmd, { cps = 30, chunk = 1 } = {}) {
      const chars = [...cmd];
      for (let i = 0; i <= chars.length; i += chunk) { await ui('prompt', chars.slice(0, i).join(''), true); await sleep(1000 / cps); }
      await ui('prompt', cmd, true); await sleep(450);
      await ui('prompt', cmd, false);
    }
    // Print a captured command's lines with their real relative timing (gaps capped; long gaps fast-forwarded).
    async function playScene(scene, { lineMs = 28, classify = () => '' } = {}) {
      let last = 0;
      for (const l of scene.lines) {
        const gap = l.t - last; last = l.t;
        if (gap > 2500) { const shown = 1200; await ui('ff', Math.round(gap / shown), `chờ ${fmtDur(gap)} thật`); await sleep(shown); await ui('ff', 0); } else await sleep(Math.max(lineMs, Math.min(gap, 600)));
        await ui('line', [[l.text, classify(l.text)]]);
      }
    }
    async function zoomLine(text, { scale = 1.45, hold = 2600 } = {}) {
      const id = await ui('find', text);
      if (!id) throw new Error(`line not found for zoom: ${text}`);
      await ui('mark', id, true); await ui('zoom', `[data-id="${id}"]`, scale); await sleep(hold);
      await ui('zoom', null); await sleep(900); await ui('mark', id, false);
    }
    async function clickLine(text) {
      const id = await ui('find', text);
      const b = await ui('box', `[data-id="${id}"]`);
      if (!b) throw new Error(`line not found: ${text}`);
      const x = b.l + Math.min(b.w - 20, 14 + text.length * 4.6);
      await ui('mark', id, true); await clickAt(x, b.y); return id;
    }

    // =============== Chapter 1: the agent team and AgentKit ===============
    const rec1 = await startChapter('agent_ch1');
    const CH1 = 'Chương 1 · Đội AI agent và AgentKit';
    await ui('header', CH1, 'Quy trình làm việc của đội agent');
    await ui('slide', `<div class="lead">Người dùng giao việc bằng tiếng Việt cho <b>Claude Code</b>. AgentKit cài sẵn <b>16 agent</b> chuyên trách;
      agent chính chia việc và gọi từng subagent, mỗi subagent ghi báo cáo vào <b>plans/reports/</b>.</div>
      <div class="flow">${[['planner', 'lập kế hoạch', '#f472b6'], ['fullstack-developer', 'viết / sửa code', '#60a5fa'], ['tester', 'chạy test', '#34d399'],
        ['code-reviewer', 'review diff', '#c084fc'], ['docs-manager', 'cập nhật tài liệu', '#fbbf24']]
        .map(([n, d, c], i) => `${i ? '<div class="arr">→</div>' : ''}<div class="node" style="--ac:${c}"><b>${n}</b><span>${d}</span></div>`).join('')}</div>`);
    await ui('caption', 'Đội AI agent: mỗi agent một vai trò, làm việc theo thứ tự như một nhóm phát triển', 'Sơ đồ minh hoạ vai trò; các cảnh sau là phát lại lệnh chạy thật trên máy');
    rec1.start();
    for (let i = 0; i < 5; i++) { await sleep(900); await ui('slideStep', i); }
    await sleep(4200);
    await ui('slide', '');
    await ui('clock', 'chụp lúc ' + new Date(pre.capturedAt).toLocaleTimeString('vi-VN', { timeZone: 'Asia/Bangkok' }));

    const [sVer, sDoc, sAgents, sTester, sReports] = pre.scenes;
    await ui('header', CH1, 'AgentKit CLI');
    await ui('caption', 'AgentKit (lệnh ak) cài đội agent, skill và hook vào Claude Code của dự án');
    await sleep(700);
    await typeCmd(sVer.cmd); await playScene(sVer); await sleep(1600);
    await ui('caption', 'ak doctor kiểm tra môi trường: CLI, hook, đăng nhập Claude Code, cấu hình dự án');
    await typeCmd(sDoc.cmd);
    await playScene(sDoc, { lineMs: 45, classify: (s) => (/\[OK\]/.test(s) ? 'ok' : /\[!\]/.test(s) ? 'warn' : /\[X\]/.test(s) ? 'err' : /^\|\s+[A-Z]+$/.test(s) ? 'hunk' : '') });
    await sleep(800);
    await zoomLine('54 hook(s)', { hold: 2200 });
    await ui('caption', 'Kết quả: 24 mục OK, 2 cảnh báo nhỏ, không có lỗi', 'Email tài khoản đã được ẩn khỏi video');
    await zoomLine('Summary:', { scale: 1.6, hold: 3000 });

    await ui('clear');
    await ui('header', CH1, 'Danh sách agent của dự án');
    await ui('caption', '16 agent định nghĩa sẵn trong .claude/agents/', 'planner, fullstack-developer, tester, code-reviewer, debugger, docs-manager…');
    await typeCmd(sAgents.cmd); await playScene(sAgents, { lineMs: 60 });
    await sleep(1800);
    await ui('caption', 'Mở định nghĩa agent tester');
    await clickLine('tester.md'); await sleep(500);
    await typeCmd(sTester.cmd);
    await hideCursor();
    await playScene(sTester, { lineMs: 120, classify: (s) => (/^(name|model|tools|memory):/.test(s) ? 'main' : 'dim') });
    await ui('caption', 'Mỗi agent là một file Markdown: tên, mô tả, model và công cụ được phép dùng', 'tester chạy bằng model haiku, chỉ dùng các công cụ được liệt kê');
    await sleep(1200);
    await zoomLine('model: haiku', { scale: 1.6, hold: 2600 });
    await zoomLine('tools:', { scale: 1.3, hold: 2600 });
    await ui('clear');
    await ui('header', CH1, 'Báo cáo do agent viết');
    await ui('caption', 'Mỗi agent ghi báo cáo tiếng Việt vào plans/reports/ (tên file = agent + ngày giờ + chủ đề)', `${sReports.lines.length} báo cáo có sẵn trước phiên chạy ở chương 2`);
    await typeCmd(sReports.cmd); await playScene(sReports, { lineMs: 70 });
    await sleep(4200);
    await ui('caption', '');
    await sleep(500);
    await rec1.finish(); chapters.push(rec1.info);

    // =============== Chapter 2: the agents fix a real bug ===============
    const rec2 = await startChapter('agent_ch2');
    const CH2 = 'Chương 2 · Agent làm việc thật';
    await ui('clear');
    await ui('header', CH2, 'Lỗi thật: cổng Admin dev (:5174) bị HTTP 403 khi POST/PUT');
    await ui('caption', 'Lỗi thật: CORS mặc định của backend chỉ cho phép cổng 5173', 'Cổng Admin chạy dev ở 5174 nên mọi yêu cầu POST/PUT bị từ chối (HTTP 403)');
    rec2.start();
    await sleep(800);
    await typeCmd(head.scenes[0].cmd, { cps: 45 }); await playScene(head.scenes[0]);
    await sleep(600);
    await zoomLine('app.cors.origins', { scale: 1.5, hold: 3200 });

    // ---- the nested Claude Code run ----
    await ui('clear');
    await ui('header', CH2, 'Claude Code headless điều phối 3 subagent');
    await ui('caption', 'Giao việc cho Claude Code bằng tiếng Việt (chế độ headless, quyền acceptEdits + danh sách công cụ cho phép)', 'Không dùng --dangerously-skip-permissions');
    const quoted = (s) => `"${s.replace(/"/g, '\\"')}"`;
    const shownCmd = `claude -p ${quoted(CLAUDE_PROMPT)} --output-format stream-json --verbose --permission-mode acceptEdits --allowedTools ${quoted(CLAUDE_ALLOWED)}`;
    await typeCmd(shownCmd, { cps: 70, chunk: 6 });
    await sleep(3500);
    await ui('caption', 'Mỗi dòng dưới đây dựng từ một sự kiện stream-json thật của phiên chạy', 'Thời gian chờ dài được tua nhanh, có nhãn ×N');
    await ui('clear'); await ui('panel', true);
    const meta = JSON.parse(readFileSync(path.join(CAPTURE_DIR, 'claude-stream.jsonl'), 'utf8').split('\n')[0]);
    await ui('clock', 'thời gian thật +00:00');
    let lastT = 0;
    const cards = new Map();
    const pushCard = (id, patch) => { const c = { ...(cards.get(id) || {}), ...patch }; cards.set(id, c); return ui('card', id, c); };
    let pending = null; // label of the tool being waited on
    const sub = (it) => (it.sub ? { cls: 'sub', ac: agentColor(it.agent) } : {});
    const tagSeg = (it) => (it.sub ? [[`[${it.agent}] `, 'tag']] : []);
    const lineMax = 3;
    for (const it of items) {
      // Real-time gap since the previous event: shown at real speed when short, compressed with ×N when long.
      const gap = it.t - lastT;
      if (gap > 3000) {
        const shown = Math.min(2400, 1200 + gap / 40);
        const n = Math.round(gap / shown);
        await ui('ff', n, `chờ ${fmtDur(gap)} thật`);
        if (pending) await ui('wait', `⏳ đang chờ: ${pending.slice(0, 90)}`);
        const steps = Math.max(2, Math.round(shown / 200));
        for (let k = 1; k <= steps; k++) { await ui('clock', 'thời gian thật +' + fmtClock(lastT + (gap * k) / steps)); await sleep(shown / steps); }
        await ui('ff', 0); await ui('wait', '');
      } else await sleep(Math.min(gap, 700));
      lastT = it.t;
      await ui('clock', 'thời gian thật +' + fmtClock(it.t));

      switch (it.kind) {
        case 'init':
          await ui('line', [[`$ claude -p "…" --output-format stream-json --verbose --permission-mode acceptEdits`, 'dim']]);
          await ui('line', it.lines[0]); await sleep(1200); break;
        case 'model': await pushCard(it.id, { model: it.model.replace(/^claude-/, '') }); break;
        case 'text': {
          const { lines, more } = clip(it.text, it.sub ? 2 : 14);
          for (const [i, l] of lines.entries()) await ui('line', [...(i === 0 ? tagSeg(it) : []), [(i === 0 ? '● ' : '  ') + l, it.sub ? 'dim' : 'main']], sub(it));
          if (more) await ui('line', [[`  … +${more} dòng`, 'dim']], sub(it));
          await sleep(it.sub ? 250 : 900); break;
        }
        case 'spawn': {
          const ac = agentColor(it.agent);
          await ui('line', [[`● Agent(${it.agent}) `, ''], [`"${it.desc}"`, '']], { cls: 'spawn', ac });
          const first = it.prompt.split('\n').find((l) => l.trim()) || '';
          await ui('line', [[`  ⎿ prompt: ${first.slice(0, 150)}${first.length > 150 ? '…' : ''}`, 'dim']], { ac });
          await pushCard(it.id, { agent: it.agent, desc: it.desc, ac, state: '⏳ đang chạy', active: true });
          const cap = { 'fullstack-developer': 'Agent chính gọi subagent fullstack-developer để sửa cấu hình CORS',
            tester: 'Gọi subagent tester chạy toàn bộ test backend bằng Maven (offline)', 'code-reviewer': 'Gọi subagent code-reviewer review git diff (chỉ đọc)' }[it.agent];
          await ui('caption', cap || `Gọi subagent ${it.agent}`, `subagent_type = ${it.agent} · nhiệm vụ: "${it.desc}"`);
          const id = await ui('find', `Agent(${it.agent})`);
          await ui('zoom', `[data-id="${id}"]`, 1.35); await sleep(2600); await ui('zoom', null); await sleep(900);
          pending = `Agent(${it.agent})`; break;
        }
        case 'tool': {
          await ui('line', [...tagSeg(it), ['● ' + it.label, it.sub ? '' : 'main']], sub(it));
          if (it.name === 'Edit') {
            for (const l of String(it.input.old_string).split('\n').slice(0, 2)) await ui('line', [['  - ' + l, 'del']], sub(it));
            for (const l of String(it.input.new_string).split('\n').slice(0, 2)) await ui('line', [['  + ' + l, 'add']], sub(it));
            await sleep(400);
            const id = await ui('find', '+ ' + String(it.input.new_string).split('\n')[0].slice(0, 40));
            if (id) { await ui('mark', id, true); await ui('zoom', `[data-id="${id}"]`, 1.4); await sleep(2600); await ui('zoom', null); await sleep(800); await ui('mark', id, false); }
          }
          if (it.name === 'Write') await ui('caption', `${it.agent} ghi báo cáo tiếng Việt`, rel(it.input.file_path));
          if (it.name === 'Bash' && /mvn/.test(it.input.command)) await ui('caption', 'Tester chạy: mvn -o -B -Djava.version=17 -f app/backend/pom.xml test', 'Spring Boot test trên H2 (không đụng MySQL thật)');
          pending = it.label; break;
        }
        case 'result': {
          const raw = it.text;
          const all = raw.split('\n');
          const summary = all.filter((l) => /Tests run:|BUILD (SUCCESS|FAILURE)|Total time/.test(l));
          if (summary.length >= 2) {
            await ui('line', [[`  ⎿ (${all.length} dòng output; hiển thị các dòng tổng kết)`, 'dim']], sub(it));
            for (const l of summary.slice(-8)) await ui('line', [['    ' + l.trim(), /FAIL|ERROR/.test(l) && !/Failures: 0, Errors: 0/.test(l) ? 'err' : 'ok']], sub(it));
            const key = summary.reverse().find((l) => /Tests run: \d+, Failures/.test(l) && !/ -- in /.test(l));
            await sleep(500);
            if (key) await zoomLine(key.trim().slice(0, 50), { scale: 1.45, hold: 3000 });
          } else {
            const { lines, more } = clip(raw, it.isError ? 2 : lineMax);
            for (const [i, l] of lines.entries()) await ui('line', [[(i === 0 ? '  ⎿ ' : '    ') + l.slice(0, 200), it.isError ? 'err' : 'dim']], sub(it));
            if (more) await ui('line', [[`    … +${more} dòng`, 'dim']], sub(it));
          }
          pending = null; break;
        }
        case 'deny': {
          const e = it.raw;
          await ui('line', [...tagSeg(it), [`⛔ [system/permission_denied] ${e.tool_name || 'tool'}: ${e.message || e.decision_reason_type || ''}`, 'err']], sub(it));
          await ui('caption', 'Lệnh ngoài danh sách cho phép bị chặn — agent tự đổi sang lệnh được phép', 'Quyền được kiểm soát bởi --allowedTools, không bỏ qua bảo mật');
          const id = await ui('find', 'permission_denied');
          await ui('mark', id, true); await ui('zoom', `[data-id="${id}"]`, 1.3); await sleep(2800); await ui('zoom', null); await sleep(800); await ui('mark', id, false);
          break;
        }
        case 'agentDone': {
          // The subagent's own closing lines (Status/Summary) from its real tool result.
          const lines = it.text.split('\n').map((l) => l.trim()).filter((l) => /^(Status|Summary):/.test(l));
          await ui('line', [[`  ⎿ Agent(${it.agent}) hoàn tất sau ${fmtDur(it.ms)} thật`, 'ok']], { ac: agentColor(it.agent) });
          for (const l of lines) await ui('line', [['    ' + l.slice(0, 200), /Status:/.test(l) ? 'st' : 'dim']], { ac: agentColor(it.agent) });
          await pushCard(it.id, { state: (it.status || 'không có dòng Status') + ' · ' + fmtDur(it.ms), fin: true, active: true });
          await ui('caption', `${it.agent} kết thúc: ${it.status || '(không có dòng Status)'}`, it.agent === 'tester' ? 'Báo cáo kiểm thử đã ghi vào plans/reports/' : 'Báo cáo đã ghi vào plans/reports/');
          await ui('zoom', `#card-${it.id}`, 1.5); await sleep(3000); await ui('zoom', null); await sleep(900);
          pending = null; break;
        }
        case 'final': {
          const e = it.ev;
          await ui('line', [[`✔ [result/${e.subtype}] ${fmtDur(e.duration_ms)} · ${e.num_turns} lượt · is_error=${e.is_error}`, e.is_error ? 'err' : 'ok']]);
          await ui('caption', 'Phiên chạy kết thúc — agent chính tóm tắt kết quả bằng tiếng Việt', `Tổng thời gian thật: ${fmtDur(e.duration_ms)}`);
          await sleep(4500); break;
        }
      }
    }
    void meta;
    await ui('panel', false);
    await ui('clock', '');

    // ---- verify the result ourselves ----
    await ui('clear');
    await ui('header', CH2, 'Kiểm tra lại kết quả của agent');
    const [sStatus, sDiff, sReports2] = post.scenes;
    await ui('caption', 'Kiểm tra độc lập: chỉ 2 file cấu hình CORS bị sửa, cộng các báo cáo mới');
    await typeCmd(sStatus.cmd); await playScene(sStatus, { lineMs: 80, classify: (s) => (/^\?\?/.test(s) ? 'dim' : 'warn') });
    await sleep(2200);
    await typeCmd(sDiff.cmd);
    await playScene(sDiff, { lineMs: 55, classify: (s) => (/^\+[^+]/.test(s) ? 'add' : /^-[^-]/.test(s) ? 'del' : /^@@/.test(s) ? 'hunk' : 'dim') });
    await ui('caption', 'git diff: thêm http://localhost:5174 và http://127.0.0.1:5174, giữ nguyên hai origin 5173');
    await sleep(800);
    await zoomLine('+app.cors.origins', { scale: 1.35, hold: 3400 });
    await ui('clear');
    const before = new Set(sReports.lines.map((l) => l.text.trim()));
    const fresh = sReports2.lines.map((l) => l.text.trim()).filter((n) => n && !before.has(n));
    await ui('caption', `${fresh.length} báo cáo mới do các agent vừa viết`, fresh.join(' · '));
    await typeCmd(sReports2.cmd);
    await playScene(sReports2, { lineMs: 60, classify: (s) => (fresh.includes(s.trim()) ? 'ok' : 'dim') });
    for (const n of fresh) await ui('mark', await ui('find', n), true);
    await sleep(2500);
    for (const n of fresh) await ui('mark', await ui('find', n), false);
    const showReport = fresh.find((n) => n.startsWith('tester')) || fresh[0];
    if (showReport) {
      await ui('caption', 'Mở báo cáo agent tester vừa viết');
      await clickLine(showReport);
      await ui('viewer', 'plans/reports/' + showReport, readFileSync(path.join(ROOT, 'plans', 'reports', showReport), 'utf8').trim());
      await hideCursor();
      await ui('caption', 'Báo cáo tiếng Việt của agent: lệnh đã chạy, kết quả test, kết luận và dòng Status', 'plans/reports/' + showReport);
      await sleep(4500);
      for (let k = 0; k < 6 && await ui('vscroll', 260); k++) await sleep(1800);
      await sleep(2500);
      await ui('viewer', '');
    }

    await ui('clear');
    await ui('header', CH2, 'Chạy lại bộ test backend (kiểm chứng độc lập)');
    await ui('caption', 'Tự chạy lại toàn bộ test backend sau khi agent sửa', 'mvn verify cũng tạo báo cáo độ phủ JaCoCo');
    await typeCmd(verify.scenes[0].cmd, { cps: 45 });
    await playScene(verify.scenes[0], { lineMs: 90, classify: (s) => (/BUILD SUCCESS|Failures: 0, Errors: 0/.test(s) ? 'ok' : /FAIL|ERROR/.test(s) ? 'err' : 'dim') });
    await sleep(800);
    const total = verify.scenes[0].lines.map((l) => l.text).reverse().find((l) => /Tests run: \d+, Failures/.test(l) && !/ -- in /.test(l));
    if (total) await zoomLine(total.trim().slice(0, 40), { scale: 1.5, hold: 3200 });

    await ui('clear');
    await ui('header', CH2, 'CI GitHub Actions');
    await ui('caption', 'CI trên GitHub Actions: mỗi lần push chạy Maven verify + JaCoCo và build frontend');
    const [sList, sView] = ci.scenes;
    await typeCmd(sList.cmd); await playScene(sList, { lineMs: 200, classify: () => 'ok' });
    await sleep(2000);
    await typeCmd(sView.cmd);
    await playScene(sView, { lineMs: 40, classify: (s) => (/✓/.test(s) ? 'ok' : /✗|X /.test(s) ? 'err' : 'dim') });
    await ui('caption', 'Lần chạy CI mới nhất: cả hai job đều xanh', 'Backend (Maven verify + JaCoCo) · Frontend (npm build)');
    await sleep(800);
    await zoomLine('✓ Backend', { scale: 1.5, hold: 3400 });
    await sleep(1500);
    await ui('caption', '');
    await sleep(500);
    await rec2.finish(); chapters.push(rec2.info);
  } catch (e) {
    const shot = await page.send('Page.captureScreenshot', { format: 'png' }).catch(() => null);
    if (shot) { const f = path.join(tmpdir(), 'ims-agent-error.png'); writeFileSync(f, Buffer.from(shot.data, 'base64')); console.error('screenshot: ' + f); }
    throw e;
  } finally {
    for (const r of active) await r.stop();
    page.close();
    rmSync(htmlDir, { recursive: true, force: true });
  }
  for (const c of chapters) console.log(`wrote ${c.out} (${(statSync(c.out).size / 1048576).toFixed(1)} MB, ${c.frames} frames, ${c.seconds.toFixed(1)} s)`);

  async function startChapter(name) {
    const framesDir = process.env.FRAMES_DIR ? path.resolve(process.env.FRAMES_DIR, name) : mkdtempSync(path.join(tmpdir(), `ims-${name}-`));
    mkdirSync(framesDir, { recursive: true });
    const rec = createRecorder(page, { framesDir });
    const out = path.join(outDir, `${name}.mp4`);
    const info = { out };
    return {
      info,
      start: () => { rec.start(); active.add(rec); info.t0 = rec.now(); },
      async finish() {
        await rec.stop(); active.delete(rec);
        rec.encode({ ffmpeg: FFMPEG, out, width: W, height: H, fps: FPS, crf: 22 });
        info.frames = rec.frames.length; info.seconds = rec.now() - info.t0;
        if (!process.env.FRAMES_DIR) rmSync(framesDir, { recursive: true, force: true });
      },
    };
  }
}

// ---------- entry ----------
const [mode, arg] = process.argv.slice(2);
try {
  if (mode === 'capture') await capture(arg);
  else if (mode === 'claude') await runClaude();
  else if (mode === 'record') await record(arg);
  else { console.error('usage: node src/record_agent_demo.mjs capture <pre|head|post|verify|ci> | claude | record [outDir]'); process.exitCode = 2; }
} catch (e) {
  console.error(e.message);
  process.exitCode = 1;
}
