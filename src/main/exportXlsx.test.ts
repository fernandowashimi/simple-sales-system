import ExcelJS from 'exceljs'
import { expect, test } from 'vitest'
import { buildSalesWorkbook } from './exportXlsx'
import type { SaleRow } from '../shared/types'

const row = (over: Partial<SaleRow> = {}): SaleRow => ({
  saleId: 1,
  itemId: 1,
  date: '2026-11-19',
  buyerId: 1,
  buyerName: 'João Silva',
  productId: 1,
  productName: 'Jaca Sidhu',
  quantity: 2,
  unitPriceCents: 4500,
  subtotalCents: 9000,
  shipped: true,
  ...over
})

async function load(rows: SaleRow[]): Promise<ExcelJS.Worksheet> {
  const wb = new ExcelJS.Workbook()
  const buf = await buildSalesWorkbook(rows)
  await wb.xlsx.load(buf as unknown as ExcelJS.Buffer)
  return wb.getWorksheet('Vendas')!
}

test('header, typed cells, null buyer', async () => {
  const ws = await load([row(), row({ itemId: 2, buyerName: null, shipped: false })])
  expect((ws.getRow(1).values as unknown[]).slice(1)).toEqual(['Data', 'Comprador', 'Produto', 'Qtd', 'Preço unit.', 'Subtotal', 'Enviado'])
  const d = ws.getCell(2, 1).value as Date
  expect(d).toBeInstanceOf(Date)
  expect([d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()]).toEqual([2026, 10, 19])
  expect(ws.getCell(2, 5).value).toBe(45)
  expect(ws.getCell(2, 6).value).toBe(90)
  expect(ws.getCell(2, 5).numFmt).toContain('R$')
  expect(ws.getCell(2, 7).value).toBe('Sim')
  expect(ws.getCell(3, 2).value).toBe('')
  expect(ws.getCell(3, 7).value).toBe('Não')
})

test('zero rows still produce header', async () => {
  const ws = await load([])
  expect(ws.rowCount).toBe(1)
})
