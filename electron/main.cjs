const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

// IMPORTANT: Start the Express server
// In a packaged app, __dirname points to resources/app.asar/electron
// We can just require the server file so it runs in this process
require('../server/server.js');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    show: false, // Don't show until ready
    icon: path.join(__dirname, '../public/favicon.ico'),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // Load the local Express server
  mainWindow.loadURL('http://localhost:5000');

  // Remove default menu bar for a cleaner "app" look
  mainWindow.setMenuBarVisibility(false);

  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  mainWindow.on('closed', function () {
    mainWindow = null;
  });
}

// Wait a bit for the Express server to actually start listening
app.whenReady().then(() => {
  setTimeout(createWindow, 1000);

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', function () {
  if (process.platform !== 'darwin') app.quit();
});
