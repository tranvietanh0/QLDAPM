// Render Mermaid diagrams (docs/figures/*.mmd) and screenshot the running IMS app into docs/figures/*.png
// using headless Edge/Chrome over the DevTools protocol. No npm dependencies (Node 22+ for global WebSocket).
//
//   node src/capture_report_figures.mjs            # diagrams + app screenshots
//   node src/capture_report_figures.mjs diagrams   # diagrams only
//
// App screenshots need the API on :8081 and two Vite servers: intern portal on :5173 and admin portal on :5174
// (VITE_PORTAL=admin). Demo password is read from IMS_DEMO_PASSWORD.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { apiLogin, openPage, sleep } from './cdp_browser.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const FIG = path.join(ROOT, 'docs', 'figures');

const SHOTS = [
  { file: 'app-admin-login.png', portal: 'admin', origin: 'http://127.0.0.1:5174', route: '/login', email: null },
  { file: 'app-admin-dashboard.png', portal: 'admin', origin: 'http://127.0.0.1:5174', route: '/dashboard', email: 'admin@gmail.com' },
  { file: 'app-admin-interns.png', portal: 'admin', origin: 'http://127.0.0.1:5174', route: '/interns', email: 'admin@gmail.com' },
  { file: 'app-admin-tasks.png', portal: 'admin', origin: 'http://127.0.0.1:5174', route: '/tasks', email: 'admin@gmail.com' },
  { file: 'app-mentor-dashboard.png', portal: 'admin', origin: 'http://127.0.0.1:5174', route: '/dashboard', email: 'mentor@gmail.com' },
  { file: 'app-intern-tasks.png', portal: 'intern', origin: 'http://127.0.0.1:5173', route: '/tasks', email: 'intern@gmail.com' },
  { file: 'app-intern-reports.png', portal: 'intern', origin: 'http://127.0.0.1:5173', route: '/reports', email: 'intern@gmail.com' },
];

async function screenshot(page, file, clip) {
  const r = await page.send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip } : {}), captureBeyondViewport: !!clip });
  writeFileSync(path.join(FIG, file), Buffer.from(r.data, 'base64'));
  console.log('wrote docs/figures/' + file);
}

async function renderDiagrams(page) {
  for (const name of readdirSync(FIG).filter((f) => f.endsWith('.mmd'))) {
    const src = readFileSync(path.join(FIG, name), 'utf8');
    const html = path.join(tmpdir(), 'ims-mermaid.html');
    writeFileSync(html, `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#fff">
<pre class="mermaid" style="display:inline-block;padding:16px">${src.replace(/</g, '&lt;')}</pre>
<script type="module">import m from 'https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs';
m.initialize({startOnLoad:false,theme:'default',fontFamily:'Times New Roman',flowchart:{htmlLabels:true}});
await m.run();document.body.dataset.done='1';</script>`);
    await page.send('Page.navigate', { url: pathToFileURL(html).href });
    await page.waitFor("document.body && document.body.dataset.done==='1'");
    const box = await page.evaluate("(()=>{const r=document.querySelector('pre.mermaid').getBoundingClientRect();return {x:r.x,y:r.y,width:Math.ceil(r.width),height:Math.ceil(r.height)}})()");
    await screenshot(page, name.replace(/\.mmd$/, '.png'), { ...box, scale: 2 });
  }
}

async function captureApp(page) {
  const tokens = {};
  for (const s of SHOTS) {
    await page.send('Page.navigate', { url: s.origin + '/' });
    await page.waitFor("document.readyState==='complete'");
    if (s.email) {
      const key = `${s.portal}:${s.email}`;
      tokens[key] ??= await apiLogin(s.portal, s.email);
      await page.evaluate(`localStorage.setItem('ims-${s.portal}-token', ${JSON.stringify(tokens[key])}); true`);
    } else {
      await page.evaluate('localStorage.clear(); true');
    }
    await page.send('Page.navigate', { url: s.origin + s.route });
    await page.waitFor(s.email ? "!!document.querySelector('nav, aside, .sidebar')" : "!!document.querySelector('form')");
    await sleep(2500);
    await screenshot(page, s.file);
  }
}

const page = await openPage();
try {
  await renderDiagrams(page);
  if (process.argv[2] !== 'diagrams') await captureApp(page);
} finally {
  page.close();
}
