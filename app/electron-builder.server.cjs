module.exports = {
  appId: 'com.qldapm.admin', productName: 'QLDAPM Admin Server',
  extraMetadata: { desktopMode: 'admin' },
  directories: { output: 'dist-server' },
  files: ['desktop/**/*.cjs', 'frontend/dist/**/*', 'package.json'],
  win: { target: [{ target: 'portable', arch: ['x64'] }], artifactName: 'QLDAPM-Server.exe' }
};
