import { app, dialog, shell, BrowserWindow } from 'electron'
import type { DatabaseSync } from 'node:sqlite'
import { readFileSync } from 'node:fs'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import seedCsvPath from '../../resources/produtos-seed.csv?asset'
import { openDb } from './db/schema'
import { parseSeedCsv, seedProductsIfEmpty } from './db/seed'
import { registerIpc } from './ipc'

function createWindow(): void {
  const mainWindow = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1100,
    minHeight: 700,
    title: 'Gestão de Vendas',
    show: false,
    autoHideMenuBar: true,
    icon,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  mainWindow.on('ready-to-show', () => mainWindow.show())

  mainWindow.webContents.setWindowOpenHandler((details) => {
    if (details.url.startsWith('https://')) shell.openExternal(details.url)
    return { action: 'deny' }
  })
  // the window only ever shows the app itself
  mainWindow.webContents.on('will-navigate', (e, url) => {
    if (url !== mainWindow.webContents.getURL()) e.preventDefault()
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// one window on one database: a second launch focuses the first instead
if (!app.requestSingleInstanceLock()) app.quit()
app.on('second-instance', () => {
  const win = BrowserWindow.getAllWindows()[0]
  if (win) {
    if (win.isMinimized()) win.restore()
    win.focus()
  }
})

app.whenReady().then(() => {
  electronApp.setAppUserModelId('br.com.fructus.vendas')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  const dbPath = join(app.getPath('userData'), 'vendas.db')
  let db: DatabaseSync
  try {
    db = openDb(dbPath)
    seedProductsIfEmpty(db, parseSeedCsv(readFileSync(seedCsvPath, 'utf8')))
  } catch (e) {
    dialog.showErrorBox('Não foi possível abrir o banco de dados', `${dbPath}\n\n${(e as Error).message}`)
    app.quit()
    return
  }
  registerIpc(db, dbPath)
  app.on('will-quit', () => db.close())

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
