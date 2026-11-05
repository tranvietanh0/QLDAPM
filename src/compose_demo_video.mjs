// Compose the final demo video: title card -> chapter 1 (agent team) -> chapter 2 (real agent run) ->
// chapter 3 (the running web app) -> closing card with measured metrics. Silent, 1440x900, 25 fps, H.264.
//
//   node src/compose_demo_video.mjs [output.mp4]
//
// Inputs (see record_agent_demo.mjs and record_demo_video.mjs):
//   docs/video/agent_ch1.mp4, docs/video/agent_ch2.mp4   terminal replays of real captured runs
//   docs/video/IMS_web_segment.mp4                       web walkthrough (its own title/closing cards are trimmed)
//   docs/video/agent_capture/*.json(l)                   captured outputs used for the closing-card metrics
//   app/backend/target/site/jacoco/jacoco.csv            line coverage from the captured `mvn verify` run
//   plans/reports/tester-261105-1040-mutation-check.md   mutation score
// Cards are rendered as HTML in headless Edge, then animated with a slow zoom; segments are joined with xfade.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openPage, sleep } from './cdp_browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const VIDEO = path.join(ROOT, 'docs', 'video');
const CAPTURE = path.join(VIDEO, 'agent_capture');
const OUT = path.resolve(process.argv[2] || path.join(VIDEO, 'IMS_demo.mp4'));
const FFMPEG = process.env.FFMPEG
  || 'C:/Users/tranv/AppData/Local/Microsoft/WinGet/Packages/Gyan.FFmpeg_Microsoft.Winget.Source_8wekyb3d8bbwe/ffmpeg-9.0.2-full_build/bin/ffmpeg.exe';
const FFPROBE = FFMPEG.replace(/ffmpeg(\.exe)?$/i, 'ffprobe$1');
const W = 1440, H = 900, FPS = 25, XF = 0.8; // crossfade length in seconds
// Web segment: 5.00 s is the first frame after its own title card, 140.88 s the first frame of its closing card.
const WEB_START = 5.0, WEB_END = 140.84;

const fail = (msg) => { throw new Error(msg); };
const vn = (x, digits = 2) => x.toFixed(digits).replace('.', ',');

function probeDuration(file) {
  const r = spawnSync(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file], { encoding: 'utf8' });
  const d = parseFloat(r.stdout);
  if (r.status !== 0 || !Number.isFinite(d)) fail(`ffprobe failed for ${file}: ${r.stderr}`);
  return d;
}

/** Read every closing-card number from captured evidence; refuse to compose if any is missing. */
function readMetrics() {
  const verify = JSON.parse(readFileSync(path.join(CAPTURE, 'terminal-verify.json'), 'utf8'));
  const vlines = verify.scenes[0].lines.map((l) => l.text);
  const total = vlines.reverse().find((l) => /Tests run: \d+, Failures/.test(l) && !/ -- in /.test(l)) || fail('no test total in terminal-verify.json');
  const [, run, failures, errors] = total.match(/Tests run: (\d+), Failures: (\d+), Errors: (\d+)/).map(Number);
  if (!vlines.some((l) => /BUILD SUCCESS/.test(l))) fail('verify run was not BUILD SUCCESS');

  const csv = path.join(ROOT, 'app', 'backend', 'target', 'site', 'jacoco', 'jacoco.csv');
  if (!existsSync(csv)) fail(`missing ${csv} (run: node src/record_agent_demo.mjs capture verify)`);
  if (statSync(csv).mtimeMs < Date.parse(verify.scenes[0].startedAt)) fail('jacoco.csv is older than the captured verify run');
  const rows = readFileSync(csv, 'utf8').trim().split(/\r?\n/);
  const col = rows[0].split(',');
  const iM = col.indexOf('LINE_MISSED'), iC = col.indexOf('LINE_COVERED');
  let missed = 0, covered = 0;
  for (const r of rows.slice(1)) { const c = r.split(','); missed += +c[iM]; covered += +c[iC]; }
  const coverage = (100 * covered) / (covered + missed);

  const ci = JSON.parse(readFileSync(path.join(CAPTURE, 'terminal-ci.json'), 'utf8'));
  const [state, conclusion] = ci.scenes[0].lines[0].text.split('\t');
  const jobs = ci.scenes[1].lines.filter((l) => /^[✓X✗] /.test(l.text.trim()) && / in \d/.test(l.text));
  const jobsOk = jobs.filter((l) => l.text.trim().startsWith('✓')).length;

  const mut = readFileSync(path.join(ROOT, 'plans', 'reports', 'tester-261105-1040-mutation-check.md'), 'utf8').match(/mutation score (\d+)\/(\d+)/i)
    || fail('mutation score not found');

  const stream = readFileSync(path.join(CAPTURE, 'claude-stream.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l));
  const result = stream.find((r) => r.ev?.type === 'result')?.ev || fail('no result event in claude-stream.jsonl');
  const agents = stream.flatMap((r) => (r.ev?.type === 'assistant' && !r.ev.parent_tool_use_id ? r.ev.message.content : []))
    .filter((c) => c.type === 'tool_use' && c.name === 'Agent').map((c) => c.input.subagent_type);

  return { run, passed: run - failures - errors, coverage, covered, lines: covered + missed, ciOk: state === 'completed' && conclusion === 'success',
    jobs: jobs.length, jobsOk, mutation: `${mut[1]}/${mut[2]}`, runMs: result.duration_ms, agents };
}

const CARD_CSS = `*{box-sizing:border-box}html,body{margin:0;height:100%;overflow:hidden}
body{display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;color:#fff;font-family:'Segoe UI',Arial,sans-serif;
  background:radial-gradient(circle at 15% 10%,rgba(99,102,241,.55),transparent 45%),radial-gradient(circle at 85% 90%,rgba(13,148,136,.55),transparent 45%),#0b1120;padding:60px}
.k{font-size:24px;letter-spacing:.18em;text-transform:uppercase;color:#a5b4fc;font-weight:700;margin-bottom:18px}
h1{font-size:58px;line-height:1.2;margin:0 0 14px;font-weight:800;max-width:1250px}
h2{font-size:38px;margin:0 0 30px;font-weight:600;color:#99f6e4}
.line{width:160px;height:5px;border-radius:5px;background:linear-gradient(90deg,#6366f1,#14b8a6);margin:10px auto 30px}
p{font-size:28px;margin:8px 0;color:#e2e8f0}p.s{font-size:22px;color:#94a3b8;margin-top:26px}
.num{font-size:150px;font-weight:900;line-height:1;background:linear-gradient(90deg,#818cf8,#2dd4bf);-webkit-background-clip:text;color:transparent}
.grid{display:grid;grid-template-columns:repeat(4,250px);gap:22px;margin:16px 0 26px}
.t{background:rgba(15,23,42,.8);border:1px solid #334155;border-radius:18px;padding:22px 14px}
.t b{display:block;font-size:44px;color:#5eead4;margin-bottom:6px}.t span{font-size:19px;color:#cbd5e1}`;

function cards(m) {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  const chapter = (n, title, sub) => `<div class="k">Chương ${n}</div><div class="num">${n}</div><div class="line"></div><h1>${esc(title)}</h1><p>${esc(sub)}</p>`;
  const mins = Math.floor(m.runMs / 60000), secs = Math.round((m.runMs % 60000) / 1000);
  return {
    title: `<div class="k">Đồ án môn Quản lý dự án phần mềm</div>
      <h1>Xây dựng dự án phần mềm bằng đội AI Agent</h1><h2>Hệ thống quản lý thực tập sinh (IMS)</h2><div class="line"></div>
      <p>Sinh viên: <b>Trần Việt Anh</b></p><p>Claude Code + AgentKit · Spring Boot · React · MySQL</p>
      <p class="s">Video demo có phụ đề, không lồng tiếng · mọi cảnh terminal là phát lại phiên chạy thật</p>`,
    ch1: chapter(1, 'Đội AI agent và AgentKit', '16 agent chuyên trách, cài bằng AgentKit cho Claude Code'),
    ch2: chapter(2, 'Agent làm việc thật', `Sửa lỗi CORS thật: ${m.agents.join(' → ')}`),
    ch3: chapter(3, 'Ứng dụng chạy thật', 'Admin · Mentor · Thực tập sinh trên Spring Boot + MySQL'),
    end: `<div class="k">Tổng kết</div><h1>Kết quả đo được</h1><div class="line"></div>
      <div class="grid">
        <div class="t"><b>${m.passed}/${m.run}</b><span>test backend pass</span></div>
        <div class="t"><b>${m.ciOk && m.jobsOk === m.jobs ? 'Xanh' : 'Đỏ'}</b><span>CI GitHub Actions (${m.jobsOk}/${m.jobs} job)</span></div>
        <div class="t"><b>${m.mutation}</b><span>đột biến bị test phát hiện</span></div>
        <div class="t"><b>${vn(m.coverage)}%</b><span>độ phủ dòng (JaCoCo)</span></div>
      </div>
      <p>${m.agents.length} subagent sửa lỗi CORS thật trong ${mins} phút ${secs} giây</p>
      <p class="s">Số liệu lấy từ lần chạy mvn verify, gh run view và báo cáo mutation của agent tester</p>`,
  };
}

async function renderCards(html, dir) {
  const page = await openPage({ port: 9336, width: W, height: H });
  const files = {};
  try {
    for (const [name, body] of Object.entries(html)) {
      const file = path.join(dir, `${name}.html`);
      writeFileSync(file, `<!doctype html><html lang="vi"><head><meta charset="utf-8"><style>${CARD_CSS}</style></head><body>${body}</body></html>`);
      await page.send('Page.navigate', { url: 'file:///' + file.replace(/\\/g, '/') });
      await page.waitFor("document.readyState==='complete'");
      await page.evaluate('document.fonts.ready.then(() => true)');
      await sleep(300);
      const shot = await page.send('Page.captureScreenshot', { format: 'png' });
      files[name] = path.join(dir, `${name}.png`);
      writeFileSync(files[name], Buffer.from(shot.data, 'base64'));
    }
  } finally { page.close(); }
  return files;
}

async function main() {
  if (!existsSync(FFMPEG)) fail(`ffmpeg not found at ${FFMPEG} (set FFMPEG)`);
  const seg = (n) => { const f = path.join(VIDEO, n); if (!existsSync(f)) fail(`missing ${f}`); return f; };
  const ch1 = seg('agent_ch1.mp4'), ch2 = seg('agent_ch2.mp4'), web = seg('IMS_web_segment.mp4');
  if (path.resolve(web) === OUT) fail('output would overwrite the web segment');
  const m = readMetrics();
  console.log('metrics:', JSON.stringify(m));

  const dir = mkdtempSync(path.join(tmpdir(), 'ims-compose-'));
  try {
    const png = await renderCards(cards(m), dir);
    // [label, kind, file, duration, transition into the NEXT segment]
    const parts = [
      ['title', 'card', png.title, 7, 'fade'],
      ['ch1card', 'card', png.ch1, 4.5, 'smoothleft'],
      ['ch1', 'video', ch1, probeDuration(ch1), 'fadeblack'],
      ['ch2card', 'card', png.ch2, 4.5, 'smoothleft'],
      ['ch2', 'video', ch2, probeDuration(ch2), 'fadeblack'],
      ['ch3card', 'card', png.ch3, 4.5, 'smoothleft'],
      ['web', 'web', web, WEB_END - WEB_START, 'fadeblack'],
      ['end', 'card', png.end, 11, null],
    ];
    const args = ['-y', '-loglevel', 'error'];
    const filters = [];
    parts.forEach(([, kind, file, dur], i) => {
      if (kind === 'card') {
        const frames = Math.round(dur * FPS);
        args.push('-loop', '1', '-framerate', String(FPS), '-t', dur.toFixed(3), '-i', file);
        // Upscale first so the slow zoom moves in sub-pixel steps (zoompan rounds to whole input pixels).
        filters.push(`[${i}:v]scale=${W * 2}:${H * 2}:flags=lanczos,zoompan=z='1+0.035*on/${frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=${W}x${H}:fps=${FPS},`
          + `trim=duration=${dur.toFixed(3)},setpts=PTS-STARTPTS,format=yuv420p,setsar=1,settb=AVTB[v${i}]`);
      } else {
        args.push('-i', file);
        const trim = kind === 'web' ? `trim=start=${WEB_START}:end=${WEB_END},` : '';
        filters.push(`[${i}:v]${trim}setpts=PTS-STARTPTS,fps=${FPS},scale=${W}:${H}:flags=lanczos,format=yuv420p,setsar=1,settb=AVTB[v${i}]`);
      }
    });
    let prev = 'v0', t = parts[0][3];
    const chapters = [{ label: parts[0][0], at: 0 }];
    for (let i = 1; i < parts.length; i++) {
      const offset = t - XF;
      const label = i === parts.length - 1 ? 'vout' : `x${i}`;
      filters.push(`[${prev}][v${i}]xfade=transition=${parts[i - 1][4]}:duration=${XF}:offset=${offset.toFixed(3)}[${label}]`);
      chapters.push({ label: parts[i][0], at: offset });
      prev = label; t = offset + parts[i][3];
    }
    const graph = path.join(dir, 'graph.txt');
    writeFileSync(graph, filters.join(';\n'));
    args.push('-/filter_complex', graph, '-map', '[vout]', '-r', String(FPS), '-c:v', 'libx264', '-preset', 'slow', '-crf', '24',
      '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-movflags', '+faststart', '-an', OUT);
    console.log(`encoding ~${t.toFixed(1)} s ...`);
    const r = spawnSync(FFMPEG, args, { stdio: 'inherit' });
    if (r.status !== 0) fail(`ffmpeg failed (exit ${r.status})`);
    console.log(`wrote ${OUT} (${(statSync(OUT).size / 1048576).toFixed(1)} MB, ${probeDuration(OUT).toFixed(2)} s)`);
    for (const c of chapters) console.log(`  ${String(Math.floor(c.at / 60)).padStart(2, '0')}:${String(Math.floor(c.at % 60)).padStart(2, '0')}  ${c.label}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

main().catch((e) => { console.error(e.message); process.exitCode = 1; });
