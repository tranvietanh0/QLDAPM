module.exports = {
  appId: 'com.qldapm.intern', productName: 'QLDAPM Client',
  extraMetadata: { desktopMode: 'intern' },
  directories: { output: 'dist-electron' },
  files: ['desktop/**/*.cjs', 'frontend/dist/**/*', 'package.json'],
  win: { target: [{ target: 'portable', arch: ['x64'] }], artifactName: 'QLDAPM-Client.exe' }
};
