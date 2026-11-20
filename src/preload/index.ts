import { contextBridge, ipcRenderer } from 'electron'
import type { Api } from './index.d'

async function call<T>(channel: string, ...args: unknown[]): Promise<T> {
  const res = await ipcRenderer.invoke(channel, ...args)
  if (!res.ok) throw new Error(res.error)
  return res.data as T
}

const api: Api = {
  products: {
    list: () => call('products:list'),
    create: (name) => call('products:create', name),
    rename: (id, name) => call('products:rename', id, name),
    remove: (id) => call('products:remove', id)
  },
  buyers: { list: () => call('buyers:list') },
  sales: {
    save: (input) => call('sales:save', input),
    get: (id) => call('sales:get', id),
    remove: (id) => call('sales:remove', id),
    rows: () => call('sales:rows'),
    exportXlsx: (rows) => call('sales:exportXlsx', rows)
  },
  db: {
    backup: () => call('db:backup'),
    path: () => call('db:path')
  }
}

contextBridge.exposeInMainWorld('api', api)
