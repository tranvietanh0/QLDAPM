import { existsSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
function newest(file) {
  if (!existsSync(file)) return 0;
  const stat = statSync(file);
  return stat.isDirectory() ? Math.max(stat.mtimeMs, ...readdirSync(file).map(name => newest(path.join(file, name)))) : stat.mtimeMs;
}
export async function launchDesktop(mode) {
  const admin = mode === 'admin';
  const label = admin ? 'ADMIN / SERVER' : 'INTERN / CLIENT';
  const exe = path.join(root, admin ? 'dist-server' : 'dist-electron', admin ? 'QLDAPM-Server.exe' : 'QLDAPM-Client.exe');
  const env = { ...process.env, QLDAPM_PROJECT_ROOT: root, QLDAPM_DESKTOP_MODE: mode };
  delete env.ELECTRON_RUN_AS_NODE;
  let application;
  const run = (command, args, visible = false) => new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: root, env, stdio: 'inherit', windowsHide: !visible });
    if (visible) application = child;
    child.once('error', reject); child.once('exit', code => resolve(code ?? 1));
  });
  const stop = () => {
    if (application?.pid && application.exitCode === null) {
      // Closing the app normally gives the Admin app time to stop its backend.
      const script = '$p=Get-Process -Id ' + application.pid + ' -ErrorAction SilentlyContinue; if($p){$null=$p.CloseMainWindow()}';
      spawn('powershell.exe', ['-NoProfile', '-Command', script], { windowsHide: true, stdio: 'ignore' });
    }
  };
  process.once('SIGINT', stop); process.once('SIGTERM', stop);
  try {
    const sources = ['desktop', 'frontend/src', 'frontend/index.html', 'frontend/vite.config.js',
      'frontend/.env.production', 'frontend/package.json', 'package.json', 'electron-builder.' + (admin ? 'server' : 'client') + '.cjs'];
    const sourceTime = Math.max(...sources.map(file => newest(path.join(root, file))));
    if (!existsSync(exe) || statSync(exe).mtimeMs < sourceTime) {
      console.log('[' + label + '] Đang tạo bản .exe mới. Lần đầu có thể mất vài phút...');
      const script = admin ? 'package:server' : 'package:client';
      const code = process.env.npm_execpath
        ? await run(process.execPath, [process.env.npm_execpath, 'run', script])
        : await run(process.env.ComSpec || 'cmd.exe', ['/d', '/s', '/c', 'npm run ' + script]);
      if (code !== 0) throw new Error('Build ứng dụng thất bại. Xem lỗi ở phía trên.');
    }
    console.log('[' + label + '] Mở ' + exe);
    process.exitCode = await run(exe, [], true);
  } catch (error) {
    console.error('[' + label + '] ' + error.message);
    process.exitCode = 1;
  }
}
