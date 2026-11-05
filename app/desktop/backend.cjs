const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const { setTimeout: delay } = require('node:timers/promises');

module.exports = function backendManager(app, backend) {
  let child, starting, stopping = false;
  let state = { ready: false, message: 'Đang khởi động Server và kết nối MySQL...' };
  const logPath = path.join(app.getPath('userData'), 'server.log');
  fs.mkdirSync(path.dirname(logPath), { recursive: true });
  const log = text => fs.appendFileSync(logPath, text);
  async function health() {
    try {
      const response = await fetch(new URL('/api/health', backend), { signal: AbortSignal.timeout(2500) });
      return await response.json();
    } catch { return null; }
  }
  function valid(h) {
    return h?.service === 'intern-management' && h.status === 'UP' &&
      ['MySQL', 'MariaDB'].includes(h.database) && h.portals === 'admin-intern-v1';
  }
  async function launch() {
    try {
      const existing = await health();
      if (stopping) return state;
      if (valid(existing)) { state = { ready: true, message: 'Server sẵn sàng · MySQL XAMPP' }; return state; }
      if (existing) throw new Error('Hãy đóng Server cũ đang dùng cổng ' + backend.port + ' rồi thử khởi động lại.');
      const projectRoot = process.env.QLDAPM_PROJECT_ROOT || (app.isPackaged
        ? path.resolve(process.env.PORTABLE_EXECUTABLE_DIR || path.dirname(process.execPath), '..')
        : path.resolve(__dirname, '..'));
      if (!fs.existsSync(path.join(projectRoot, 'START_SERVER_MYSQL.bat'))) {
        throw new Error('Không tìm thấy dự án để chạy Server. Hãy đặt file exe trong dist-server của dự án hoặc chạy npm run sever.');
      }
      state = { ready: false, message: 'Đang khởi động Server và kết nối MySQL...' };
      log('\n--- Server startup ' + new Date().toISOString() + ' ---\n');
      child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'call START_SERVER_MYSQL.bat'], {
        cwd: projectRoot, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, QLDAPM_NO_PAUSE: '1', DEBUG: 'false', SERVER_PORT: backend.port || '8081' }
      });
      let spawnError;
      child.once('error', error => { spawnError = error; log(error.message + '\n'); });
      child.stdout.on('data', data => log(data));
      child.stderr.on('data', data => log(data));
      child.once('exit', code => {
        if (!stopping && state.ready) state = { ready: false, message: 'Server đã dừng. Hãy thử khởi động lại.' };
        log('\nServer process exited: ' + code + '\n');
      });
      const deadline = Date.now() + 150000;
      while (Date.now() < deadline && !stopping) {
        if (valid(await health())) { state = { ready: true, message: 'Server sẵn sàng · MySQL XAMPP' }; return state; }
        if (spawnError) throw spawnError;
        if (child.exitCode !== null) throw new Error('Server không khởi động được. Kiểm tra MySQL XAMPP. Chi tiết: ' + logPath);
        await delay(800);
      }
      if (!stopping) throw new Error('Server chưa sẵn sàng. Kiểm tra MySQL và Maven. Chi tiết: ' + logPath);
    } catch (error) {
      state = { ready: false, message: error.message };
    }
    return state;
  }
  async function start() {
    if (starting) return starting;
    if (child && child.exitCode === null && !state.ready) return state;
    starting = launch();
    try { return await starting; } finally { starting = null; }
  }
  async function stop() {
    stopping = true;
    if (!child?.pid || child.exitCode !== null) return;
    await new Promise(resolve => {
      const killer = spawn('taskkill', ['/PID', String(child.pid), '/T', '/F'], { windowsHide: true, stdio: 'ignore' });
      killer.once('error', resolve); killer.once('exit', resolve);
    });
  }
  return { start, stop, state: () => ({ ...state }) };
};
