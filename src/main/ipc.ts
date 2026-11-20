import { BrowserWindow, dialog, ipcMain } from 'electron'
import { writeFile } from 'node:fs/promises'
import type { DatabaseSync } from 'node:sqlite'
import type { SaleInput, SaleRow } from '../shared/types'
import { todayISO } from '../shared/dates'
import { createProduct, deleteProduct, listBuyers, listProducts, renameProduct } from './db/products'
import { deleteSale, getSale, listSaleRows, saveSale } from './db/sales'
import { buildSalesWorkbook } from './exportXlsx'
import { backupDb } from './backup'

type Handler = (...args: never[]) => unknown

async function saveDialog(defaultPath: string, name: string, ext: string): Promise<string | null> {
  const win = BrowserWindow.getFocusedWindow()
  const opts = { defaultPath, filters: [{ name, extensions: [ext] }] }
  const r = win ? await dialog.showSaveDialog(win, opts) : await dialog.showSaveDialog(opts)
  return r.canceled || !r.filePath ? null : r.filePath
}

export function registerIpc(db: DatabaseSync, dbPath: string): void {
  const handlers: Record<string, Handler> = {
    'products:list': () => listProducts(db),
    'products:create': (name: string) => createProduct(db, name),
    'products:rename': (id: number, name: string) => renameProduct(db, id, name),
    'products:remove': (id: number) => deleteProduct(db, id),
    'buyers:list': () => listBuyers(db),
    'sales:save': (input: SaleInput) => saveSale(db, input),
    'sales:get': (id: number) => getSale(db, id),
    'sales:remove': (id: number) => deleteSale(db, id),
    'sales:rows': () => listSaleRows(db),
    'sales:exportXlsx': async (rows: SaleRow[]) => {
      const path = await saveDialog(`vendas-${todayISO()}.xlsx`, 'Excel', 'xlsx')
      if (!path) return false
      await writeFile(path, await buildSalesWorkbook(rows))
      return true
    },
    'db:backup': async () => {
      const path = await saveDialog(`vendas-backup-${todayISO()}.db`, 'Banco de dados', 'db')
      if (!path) return false
      await backupDb(db, path)
      return true
    },
    'db:path': () => dbPath
  }

  for (const [channel, fn] of Object.entries(handlers)) {
    // Electron rewrites thrown error messages, so errors travel as data and the preload rethrows them
    ipcMain.handle(channel, async (_e, ...args) => {
      try {
        return { ok: true, data: await (fn as (...a: unknown[]) => unknown)(...args) }
      } catch (e) {
        return { ok: false, error: e instanceof Error ? e.message : String(e) }
      }
    })
  }
}
