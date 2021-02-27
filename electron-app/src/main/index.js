const { app, BrowserWindow, ipcMain, clipboard, nativeImage, Menu, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const FormData = require('form-data');
const axios = require('axios');
const { isDeepEqual } = require('../helper');

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) { // eslint-disable-line global-require
  app.quit();
}

Menu.setApplicationMenu(null);

let mainWindow = null;

global.all_partner = {};

const createWindow = () => {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 800,
    height: 600,
    show: false,
    webPreferences: {
      enableRemoteModule: true,
      nodeIntegration: true
    }
  });

  // and load the index.html of the app.
  mainWindow.loadFile(path.join(__dirname, '..', 'render', 'index.html'));
  mainWindow.once('ready-to-show', mainWindow.show);

  // Open the DevTools.
  mainWindow.webContents.openDevTools();
};

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  mainWindow = null;
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here.
const { fork } = require('child_process');
const udp = fork(path.join(__dirname, 'udp.js'), {
  env: Object.assign(process.env, { KFCONFIG_DIR: app.getPath('userData') })
});
udp.on('message', message => {
  if (message.channel === 'server-report') {
    const partner = {
      remote_address: message.remote_address,
      host_name: message.host_name,
      http_port: message.http_port
    };
    if (global.all_partner[message.remote_address] === undefined
      || !isDeepEqual(global.all_partner[message.remote_address], partner)) {
      global.all_partner[message.remote_address] = partner
      mainWindow.webContents.send('partner-change', partner);
    }
  }
  console.log('udp on msg', message);
});
const server = fork(path.join(__dirname, 'server.js'));
server.on('message', message => {
  switch (message.channel) {
    case 'http-up':
      global.http_port = message.address.port;
      udp.send(message);
      break;
    case 'remote-partner':
      const partner = {
        remote_address: message.remote_address,
        host_name: message.host_name,
        http_port: message.http_port
      };
      if (global.all_partner[message.remote_address] === undefined
        || !isDeepEqual(global.all_partner[message.remote_address], partner)) {
        global.all_partner[message.remote_address] = partner
        mainWindow.webContents.send('partner-change', partner);
      }
      break;
    case 'del-partner':
      global.all_partner[message.remote_address] = undefined;
      delete global.all_partner[message.remote_address];
      mainWindow.webContents.send('partner-change');
      break;
    case 'put-clipboard':
      if (message.body.text) {
        clipboard.writeText(message.body.text);
      } else if (message.files.file && 'image/jpeg' === message.files.file.type) {
        clipboard.writeImage(nativeImage.createFromPath(message.files.file.path));
      }
      break;
    case 'post-file':
      let file_folder = store.get('file_folder', app.getPath('desktop'));
      fs.copyFile(message.files.file.path, path.join(file_folder, message.files.file.name), err => {
        if (err)
          console.error(err);
        else {
          new Notification({
            title: '文件传送成功',
            body: message.files.file.name
          }).show();
        }
      });
      break;
  }
  console.log('server on msg', message);
});
//
const Store = require('electron-store');
const store = new Store();
console.log('cwd', app.getPath('userData'));
ipcMain.on('autostart-changed', (e, checked) => {
  store.set('autostart', checked);
  app.setLoginItemSettings({
    openAtLogin: checked,
    path: path.resolve(path.dirname(process.execPath), '..', 'Update.exe'),
    args: [
      '--processStart', `"${path.basename(process.execPath)}"`,
      '--process-start-args', `"--hidden"`
    ]
  })
});
ipcMain.on('pair-code-change', (e, pair_code) => {
  udp.send({
    channel: 'pair-code-change',
    pair_code
  });
  global.all_partner = {};
});
ipcMain.handle('upload', async (e, file_path) => {
  let data = new FormData();
  data.append('file', fs.createReadStream(file_path));
  const headers = data.getHeaders();
  const partners = Object.values(global.all_partner || {}).filter(p => p != undefined);
  try {
    await Promise.all(partners.map(p => axios.post(`http://${p.remote_address}:${p.http_port}/file`, data, {
      headers,
      maxContentLength: Infinity,
      maxBodyLength: Infinity
    })));
  } catch (err) {
    return err.message;
  }
  return true;
});
ipcMain.handle('partner-off', (e, p) => {
  global.all_partner[p.remote_address] = undefined;
  delete global.all_partner[p.remote_address];
  console.log('partner off', p);
  return true;
});
//
console.log('clipboard formats', clipboard.readImage().getSize());