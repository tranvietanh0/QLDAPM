const { contextBridge, ipcRenderer } = require('electron');
const mode = process.argv.includes('--qldapm-mode=admin') ? 'admin' : 'intern';
contextBridge.exposeInMainWorld('desktopApp', Object.freeze({
  mode,
  serverState: () => ipcRenderer.invoke('qldapm:server-state'),
  retryServer: () => ipcRenderer.invoke('qldapm:retry-server')
}));
