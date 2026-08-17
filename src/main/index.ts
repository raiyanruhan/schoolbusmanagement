import { app, BrowserWindow, shell, ipcMain, protocol } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDb, closeDb, getSqlite } from './db'
import { seedInitialData } from './db/seed'
import { registerAllIpcHandlers } from './ipc'

// Serves recorded announcement clips (userData/data/audio/**) to the renderer.
// Must be registered before app is ready.
protocol.registerSchemesAsPrivileged([
  { scheme: 'audio-file', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true, bypassCSP: true, corsEnabled: true } }
])

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 1024,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    title: 'School Bus Manager',
    webPreferences: {
      preload: join(__dirname, '../preload/index.mjs'),
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  win.on('ready-to-show', () => {
    win.show()
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.schoolbus.manager')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize DB before registering IPC handlers
  initDb()
  seedInitialData(getSqlite())
  registerAllIpcHandlers()

  // ── audio-file:// protocol — serves recorded announcement clips ────────────
  const audioDir = join(app.getPath('userData'), 'data', 'audio')
  protocol.handle('audio-file', (request) => {
    const url = new URL(request.url)
    const relPath = decodeURIComponent(url.pathname).replace(/^\/+/, '')
    const filePath = join(audioDir, relPath)
    const found = existsSync(filePath)
    console.log(`[audio-file] ${request.url} -> ${filePath} (${found ? 'found' : 'MISSING'})`)
    if (!filePath.startsWith(audioDir)) {
      return Promise.resolve(new Response('Forbidden', { status: 403 }))
    }
    if (!found) {
      // Expected for clips that haven't been recorded yet — fail quietly,
      // don't hand a missing path to net.fetch (it logs a noisy net:: error).
      return Promise.resolve(new Response('Not found', { status: 404 }))
    }
    // net.fetch(file://...) doesn't set Content-Type, so <audio>/Howler
    // silently refuse to play it — read the bytes and set it ourselves.
    const data = readFileSync(filePath)
    return Promise.resolve(new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': 'audio/webm',
        'Content-Length': String(data.length),
        'Access-Control-Allow-Origin': '*'
      }
    }))
  })

  // ── Display board window ────────────────────────────────────────────────
  ipcMain.handle('window:openDisplay', () => {
    const displayWin = new BrowserWindow({
      width: 1280,
      height: 800,
      title: 'School Bus — Display Board',
      webPreferences: {
        preload: join(__dirname, '../preload/index.mjs'),
        sandbox: false,
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
      displayWin.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#/display`)
    } else {
      displayWin.loadFile(join(__dirname, '../renderer/index.html'), { hash: '/display' })
    }
  })

  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  closeDb()
  if (process.platform !== 'darwin') app.quit()
})
