const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const fs = require('node:fs');
const http = require('node:http');
const https = require('node:https');
const path = require('node:path');

const devUrl = process.env.ELECTRON_START_URL || 'http://127.0.0.1:5173';
const backend = new URL(process.env.API_SERVER || 'http://127.0.0.1:' + (process.env.API_PORT || 8081));
const mode = app.isPackaged ? require('../package.json').desktopMode : (process.env.QLDAPM_DESKTOP_MODE || 'intern');
const admin = mode === 'admin';
app.setName(admin ? 'QLDAPM Admin Server' : 'QLDAPM Client');
if (!app.commandLine.hasSwitch('user-data-dir')) app.setPath('userData', path.join(app.getPath('appData'), admin ? 'QLDAPM-Admin' : 'QLDAPM-Intern'));
const hasLock = !admin || app.requestSingleInstanceLock();
if (!hasLock) app.quit();
const manager = admin ? require('./backend.cjs')(app, backend) : null;
let localServer;
let quitting = false;

const mimeTypes = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2'
};

function proxyApi(request, response) {
  const headers = { ...request.headers, host: backend.host };
  // The frontend and this proxy share one origin. Spring receives a server-to-server request.
  // Do not forward the desktop window's random local port as a cross-origin browser request.
  delete headers.origin;
  const transport = backend.protocol === 'https:' ? https : http;
  const upstream = transport.request(new URL(request.url, backend), {
    method: request.method, headers
  }, backendResponse => {
    response.writeHead(backendResponse.statusCode || 502, backendResponse.headers);
    backendResponse.pipe(response);
  });
  upstream.setTimeout(10000, () => upstream.destroy(new Error('API timeout')));
  upstream.on('error', () => {
    if (response.headersSent) { response.destroy(); return; }
    response.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify({ error: 'Không kết nối được server. Hãy chạy npm run sever và chờ API sẵn sàng.' }));
  });
  request.on('aborted', () => upstream.destroy());
  request.pipe(upstream);
}

function serveFrontend(distRoot, request, response) {
  let pathname;
  try { pathname = decodeURIComponent(new URL(request.url, 'http://127.0.0.1').pathname); }
  catch { response.writeHead(400); response.end('Bad request'); return; }
  const candidate = path.resolve(distRoot, pathname === '/' ? 'index.html' : pathname.replace(/^\/+/, ''));
  if (!candidate.startsWith(distRoot + path.sep)) {
    response.writeHead(403); response.end('Forbidden'); return;
  }
  fs.stat(candidate, (error, stats) => {
    const useFallback = (error || stats.isDirectory()) && path.extname(candidate) === '';
    const file = useFallback ? path.join(distRoot, 'index.html') : candidate;
    fs.stat(file, (fileError, fileStats) => {
      if (fileError || !fileStats.isFile()) {
        response.writeHead(404); response.end('Not found'); return;
      }
      response.writeHead(200, {
        'Content-Type': mimeTypes[path.extname(file)] || 'application/octet-stream',
        'Content-Length': fileStats.size,
        'Cache-Control': path.basename(file) === 'index.html' ? 'no-store' : 'public, max-age=31536000'
      });
      if (request.method === 'HEAD') { response.end(); return; }
      fs.createReadStream(file).on('error', () => response.destroy()).pipe(response);
    });
  });
}

function startPackagedServer() {
  const distRoot = path.resolve(__dirname, '..', 'frontend', 'dist');
  return new Promise((resolve, reject) => {
    localServer = http.createServer((request, response) => {
      // Accept requests from our own window; external browser origins cannot use the API proxy.
      const ownOrigin = 'http://127.0.0.1:' + localServer.address().port;
      if (request.headers.origin && request.headers.origin !== ownOrigin) {
        response.writeHead(403); response.end('Forbidden origin'); return;
      }
      if ((request.url || '').startsWith('/api/')) proxyApi(request, response);
      else serveFrontend(distRoot, request, response);
    });
    localServer.once('error', reject);
    localServer.listen(0, '127.0.0.1', () => resolve('http://127.0.0.1:' + localServer.address().port + '/'));
  });
}

function createWindow(url) {
  const window = new BrowserWindow({
    title: admin ? 'InternFlow — Admin / Server' : 'InternFlow — Thực tập sinh',
    width: 1440, height: 900, minWidth: 1024, minHeight: 700,
    autoHideMenuBar: true, backgroundColor: '#f5f7fb',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true,
      preload: path.join(__dirname, 'preload.cjs'), additionalArguments: ['--qldapm-mode=' + mode] }
  });
  window.webContents.on('did-fail-load', (_event, code, description) => {
    console.error('[CLIENT] Không tải được giao diện:', code, description);
  });
  window.on('page-title-updated', event => event.preventDefault());
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, destination) => {
    if (new URL(destination).origin !== new URL(url).origin) event.preventDefault();
  });
  void window.loadURL(url);
}
if (hasLock) app.whenReady().then(async () => {
  ipcMain.handle('qldapm:server-state', () => manager?.state() || { ready: false });
  ipcMain.handle('qldapm:retry-server', () => manager?.start() || { ready: false });
  if (manager) void manager.start();
  const url = app.isPackaged && !process.env.ELECTRON_START_URL ? await startPackagedServer() : devUrl;
  createWindow(url);
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow(url);
  });
}).catch(error => {
  dialog.showErrorBox(admin ? 'Không mở được QLDAPM Admin / Server' : 'Không mở được QLDAPM Client', error.message);
  app.quit();
});
app.on('second-instance', () => {
  const window = BrowserWindow.getAllWindows()[0];
  if (window) { if (window.isMinimized()) window.restore(); window.show(); window.focus(); }
});
app.on('before-quit', event => {
  if (manager && !quitting) {
    event.preventDefault(); quitting = true;
    void manager.stop().finally(() => app.quit());
  }
});
app.on('will-quit', () => { if (localServer) localServer.close(); });
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
