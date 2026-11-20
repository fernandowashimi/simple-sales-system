import ExcelJS from 'exceljs'
import type { SaleRow } from '../shared/types'
import { PAYMENT_LABEL } from '../shared/payment'

const BRL_FMT = '"R$" #,##0.00'

export async function buildSalesWorkbook(rows: SaleRow[]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('Vendas')
  ws.columns = [
    { header: 'Data', width: 12, style: { numFmt: 'dd/mm/yyyy' } },
    { header: 'Comprador', width: 28 },
    { header: 'Produto', width: 40 },
    { header: 'Qtd', width: 8 },
    { header: 'Preço unit.', width: 14, style: { numFmt: BRL_FMT } },
    { header: 'Subtotal', width: 14, style: { numFmt: BRL_FMT } },
    { header: 'Enviado', width: 10 },
    // per-sale values repeated on each item row
    { header: 'Pago', width: 14, style: { numFmt: BRL_FMT } },
    { header: 'Situação', width: 12 }
  ]
  ws.getRow(1).font = { bold: true }
  for (const r of rows) {
    const [y, m, d] = r.date.split('-').map(Number)
    ws.addRow([
      // exceljs serializes dates from UTC, so a UTC midnight keeps the calendar day in any timezone
      new Date(Date.UTC(y, m - 1, d)),
      r.buyerName ?? '',
      r.productName,
      r.quantity,
      r.unitPriceCents / 100,
      r.subtotalCents / 100,
      r.shipped ? 'Sim' : 'Não',
      r.paidCents / 100,
      PAYMENT_LABEL[r.payment]
    ])
  }
  return Buffer.from(await wb.xlsx.writeBuffer())
}
