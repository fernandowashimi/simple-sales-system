import type { Buyer, Product, Sale, SaleInput, SaleRow } from '../shared/types'

export type Api = {
  products: {
    list(): Promise<Product[]>
    create(name: string): Promise<Product>
    rename(id: number, name: string): Promise<Product>
    remove(id: number): Promise<void>
  }
  buyers: { list(): Promise<Buyer[]> }
  sales: {
    save(input: SaleInput): Promise<number>
    get(id: number): Promise<Sale | null>
    remove(id: number): Promise<void>
    rows(): Promise<SaleRow[]>
    /** false when the save dialog was cancelled */
    exportXlsx(rows: SaleRow[]): Promise<boolean>
  }
  db: { backup(): Promise<boolean>; path(): Promise<string> }
}

declare global {
  interface Window {
    api: Api
  }
}
