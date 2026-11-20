# Sinal / situação de pagamento Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Each sale stores the amount already paid (the "sinal"), and the app derives Pendente / Sinal / Pago from it everywhere: form, list, filter, Excel.

**Architecture:** One new column `sales.paid_cents`. The status is never stored. A pure function in `src/shared/payment.ts` computes it from paid vs. sale total. `listSaleRows` attaches it to every row, so the filter, table and export only read `row.payment`.

**Tech Stack:** Electron + `node:sqlite`, React, BoardUI, TanStack Table, ExcelJS, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-20-sinal-pagamento-design.md`

## Global Constraints

- Money is integer centavos everywhere. The UI parses with `parsePriceBR` and formats with `formatPriceInput` / `formatBRL` (`src/shared/money.ts`).
- Status rule: `paid > 0 && paid >= total` → `'paid'`; `paid > 0` → `'deposit'`; else `'pending'`.
- Labels (exact): `pending` "Pendente", `deposit` "Sinal", `paid` "Pago".
- Error copy (exact): `'Sinal inválido.'` and `'Sinal maior que o total da venda.'`
- Existing databases must keep working: existing sales get `paid_cents = 0`, which is Pendente.
- UI follows AGENTS.md: BoardUI components, semantic tokens, `cx()`.
- Run `npm test` and `npm run typecheck` before each commit.

## Review Focus

- **DB from v1.0.1 without the column:** opening it adds `paid_cents` and keeps every existing sale. Test in Task 1.
- **Editing items lowers the total below the stored sinal:** saving is refused with "Sinal maior que o total da venda." and no silent clamp. Tests in Tasks 1 and 2.
- **Sinal typed as "45.50" / "1.234,56" / "R$ 10":** these parse the same way prices do. Covered by reusing `parsePriceBR`, with one form test in Task 2.
- **Grouped list rows (grouped by produto/comprador):** the Pagamento cell stays empty on group rows, like Enviado. Manual check in Task 3.
- **Multi-item sale in Excel:** each item row repeats the sale's Pago and Situação, so a sum of the Pago column double-counts. Accepted, and pinned by a test in Task 4 so the behavior is deliberate.

---

### Task 1: Payment status, column, migration, save/get/list

**Files:**
- Create: `src/shared/payment.ts`, `src/shared/payment.test.ts`
- Modify: `src/shared/types.ts`, `src/main/db/schema.ts`, `src/main/db/sales.ts`
- Test: `src/main/db/sales.test.ts`

**Interfaces:**
- Produces:
  - `export type PaymentStatus = 'pending' | 'deposit' | 'paid'`
  - `export function paymentStatus(paidCents: number, totalCents: number): PaymentStatus`
  - `export const PAYMENT_LABEL: Record<PaymentStatus, string>`
  - `SaleInput.paidCents: number`, `Sale.paidCents: number`
  - `SaleRow.paidCents: number`, `SaleRow.saleTotalCents: number`, `SaleRow.payment: PaymentStatus`

- [ ] **Step 1: Write failing tests**

`src/shared/payment.test.ts`:
```ts
test.each([
  [0, 1000, 'pending'], [1, 1000, 'deposit'], [999, 1000, 'deposit'],
  [1000, 1000, 'paid'], [0, 0, 'pending']
])('paymentStatus(%i, %i) = %s', (paid, total, s) => expect(paymentStatus(paid, total)).toBe(s))
```

`src/main/db/sales.test.ts`: add `paidCents: 0` to `base()`. The total of `base()` is 2 × 4500 = 9000. Then add:
```ts
test('paidCents round-trips and drives payment on rows', () => {
  const id = saveSale(db, base({ paidCents: 3000 }))
  expect(getSale(db, id)!.paidCents).toBe(3000)
  expect(listSaleRows(db)[0]).toMatchObject({ paidCents: 3000, saleTotalCents: 9000, payment: 'deposit' })
  saveSale(db, base({ id, paidCents: 9000 }))
  expect(listSaleRows(db)[0].payment).toBe('paid')
})
test('saleTotalCents sums all items of the sale on every row', () => {
  saveSale(db, base({ items: [{ productId: p1, quantity: 1, unitPriceCents: 100 }, { productId: p2, quantity: 2, unitPriceCents: 50 }] }))
  expect(listSaleRows(db).map((r) => r.saleTotalCents)).toEqual([200, 200])
})
test('opening a pre-sinal database adds paid_cents and keeps sales as pending', () => {
  // build a v1.0.1-shaped file without paid_cents, then reopen with openDb
  // assert: listSaleRows(reopened)[0] has paidCents 0 and payment 'pending'
})
```
Add these rows to the existing `rejects %s and writes nothing` table:
`['paid > total', { paidCents: 9001 }]`, `['negative paid', { paidCents: -1 }]`, `['fractional paid', { paidCents: 1.5 }]`.

For the migration test, use a temp file (`os.tmpdir()`). Create the `sales`, `products`, `buyers` and `sale_items` tables with the old DDL from `schema.ts` (no `paid_cents`), insert one sale and one item with raw SQL, close it, then call `openDb(path)`.

- [ ] **Step 2: Run `npm test`. It should FAIL** (missing module and properties).

- [ ] **Step 3: Implement**
- `src/shared/payment.ts`: the type, the function (per the Global Constraints rule) and `PAYMENT_LABEL`.
- `types.ts`: add the fields listed under Produces.
- `schema.ts`:
  - Add `paid_cents INTEGER NOT NULL DEFAULT 0 CHECK (paid_cents >= 0)` to `CREATE TABLE sales`.
  - After `db.exec(SCHEMA)` in `openDb`, run `ALTER TABLE sales ADD COLUMN …` with the same definition when `PRAGMA table_info(sales)` has no `paid_cents`.
- `sales.ts`:
  - `validate` throws `ValidationError('Sinal inválido.')` unless `paidCents` is an integer ≥ 0. It throws `'Sinal maior que o total da venda.'` when it exceeds Σ quantity × unitPriceCents.
  - INSERT and UPDATE write `paid_cents`. `getSale` reads it.
  - `listSaleRows` selects `s.paid_cents` and `SUM(i.quantity * i.unit_price_cents) OVER (PARTITION BY s.id) AS sale_total`, then maps `payment: paymentStatus(paid, total)`.

- [ ] **Step 4: Run `npm test` and `npm run typecheck:node`. Both PASS.** Add `paidCents: 0, saleTotalCents: 100, payment: 'pending'` to the row fixtures in `filters.test.ts` and `exportXlsx.test.ts` now. `typecheck:web` will fail in `saleForm.ts` (missing `paidCents`) until Task 2. That is the one allowed exception to the typecheck-before-commit rule.

- [ ] **Step 5: Commit** `feat: store sinal (paid_cents) and derive payment status`

---

### Task 2: Sale form: Sinal field and "Marcar como pago"

**Files:**
- Modify: `src/renderer/src/lib/saleForm.ts`, `src/renderer/src/pages/SaleFormPage.tsx`
- Test: `src/renderer/src/lib/saleForm.test.ts`

**Interfaces:**
- Consumes: `SaleInput.paidCents`, `Sale.paidCents` (Task 1).
- Produces:
  - `SaleDraft.paid: string`
  - `export function draftTotalCents(items: ItemDraft[]): number`: sum of valid filled rows, the same number the footer shows.
  - `export function isMarkedPaid(paid: string, totalCents: number): boolean`: true iff `totalCents > 0` and `parsePriceBR(paid) === totalCents`.

- [ ] **Step 1: Write failing tests** in `saleForm.test.ts`. Add `paid: ''` to `base`, and add `paidCents: 0` to the expected input of the existing parse test.
```ts
const one = [{ productId: 1, quantity: '2', price: '45' }] // total 9000
test('empty sinal -> 0', () => expect(toSaleInput({ ...base, items: one }, buyers)).toMatchObject({ input: { paidCents: 0 } }))
test('sinal parses like prices', () => expect(toSaleInput({ ...base, paid: '45.50', items: one }, buyers)).toMatchObject({ input: { paidCents: 4550 } }))
test('invalid sinal', () => expect(toSaleInput({ ...base, paid: 'x', items: one }, buyers)).toEqual({ error: 'Sinal inválido.' }))
test('sinal above total', () => expect(toSaleInput({ ...base, paid: '90,01', items: one }, buyers)).toEqual({ error: 'Sinal maior que o total da venda.' }))
test('isMarkedPaid', () => {
  expect(isMarkedPaid('90,00', 9000)).toBe(true)
  expect(isMarkedPaid('50', 9000)).toBe(false)
  expect(isMarkedPaid('', 0)).toBe(false)
})
```

- [ ] **Step 2: Run `npm test`. It should FAIL.**

- [ ] **Step 3: Implement**
- `saleForm.ts`:
  - Add `paid` to `SaleDraft`. Add `draftTotalCents` and `isMarkedPaid`.
  - In `toSaleInput`, after the items are validated: blank `paid` → 0; `parsePriceBR` null → `'Sinal inválido.'`; greater than the items total → `'Sinal maior que o total da venda.'`. Put `paidCents` in the input.
- `SaleFormPage.tsx`:
  - `emptyDraft` gets `paid: ''`. Loading a sale sets `paid: s.paidCents ? formatPriceInput(s.paidCents) : ''`.
  - Replace the inline `total` reduce with `draftTotalCents(draft.items)`. The `itemSubtotal` import goes if unused.
  - In the top Card, after "Enviado", add a "Sinal" `Input`. Copy the price input: `R$` leading addon, `inputMode="decimal"`, `placeholder="0,00"`, reformat on blur. Next to it, a `Checkbox` "Marcar como pago" with `isSelected={isMarkedPaid(draft.paid, total)}` and `onChange={(on) => setDraft((d) => ({ ...d, paid: on ? formatPriceInput(total) : '' }))}`.
  - Widen the grid columns so all four fit.

- [ ] **Step 4: Run `npm test` and `npm run typecheck`. Both PASS.** Then run `npm run dev` and check by hand:
  - Marking fills the total. Unmarking clears it.
  - Adding an item after marking unchecks the box.
  - Editing an existing sale shows its sinal.

- [ ] **Step 5: Commit** `feat: sinal field and "marcar como pago" in sale form`

---

### Task 3: Sales list: Pagamento column and filter

**Files:**
- Modify: `src/renderer/src/lib/filters.ts`, `src/renderer/src/pages/SalesPage.tsx`
- Test: `src/renderer/src/lib/filters.test.ts`

**Interfaces:**
- Consumes: `SaleRow.payment`, `PaymentStatus`, `PAYMENT_LABEL` (Task 1).
- Produces: `SalesFilters.payment: 'all' | PaymentStatus` (default `'all'`).

- [ ] **Step 1: Write failing test**
```ts
test('payment filter', () => {
  const rs = [r({ itemId: 1, payment: 'pending' }), r({ itemId: 2, payment: 'deposit' }), r({ itemId: 3, payment: 'paid' })]
  expect(filterRows(rs, { ...emptyFilters, payment: 'deposit' }).map((x) => x.itemId)).toEqual([2])
  expect(filterRows(rs, emptyFilters)).toHaveLength(3)
})
```
- [ ] **Step 2: Run `npm test`. It should FAIL.**
- [ ] **Step 3: Implement**
- `filters.ts`: add the field, the default and the predicate.
- `SalesPage.tsx`:
  - Add column `col.accessor('payment', { header: 'Pagamento', enableSorting: false, aggregationFn: () => null })` after Enviado.
  - Leaf cell renders `<Chip variant="subtle" color={…}>{PAYMENT_LABEL[...]}</Chip>` with paid `lime`, deposit `yellow`, pending `neutral`.
  - Add a `Select` next to the Enviado filter: `aria-label="Pagamento"`, `renderValue` `Pagamento: …`, options Todos / Pendente / Sinal / Pago.
- [ ] **Step 4: Run `npm test` and `npm run typecheck`. Both PASS.** In `npm run dev`, check that grouped rows leave the Pagamento cell empty and that filtering works.
- [ ] **Step 5: Commit** `feat: payment column and filter in sales list`

---

### Task 4: Excel export

**Files:**
- Modify: `src/main/exportXlsx.ts`
- Test: `src/main/exportXlsx.test.ts`

**Interfaces:**
- Consumes: `SaleRow.paidCents`, `SaleRow.payment`, `PAYMENT_LABEL` (Task 1).

- [ ] **Step 1: Update failing test**
  - The header expectation becomes `[..., 'Enviado', 'Pago', 'Situação']`.
  - For `row({ paidCents: 3000, payment: 'deposit' })`: cell (2, 8) is `30` with numFmt containing `R$`, and cell (2, 9) is `'Sinal'`.
  - Add one assertion that two item rows of the same sale both carry the same Pago value. This pins the Review Focus behavior.
- [ ] **Step 2: Run `npm test`. It should FAIL.**
- [ ] **Step 3: Implement.** Add the columns `{ header: 'Pago', width: 14, style: { numFmt: BRL_FMT } }` and `{ header: 'Situação', width: 12 }`. Each row adds `r.paidCents / 100` and `PAYMENT_LABEL[r.payment]`.
- [ ] **Step 4: Run `npm test` and `npm run typecheck`. Both PASS.**
- [ ] **Step 5: Commit** `feat: export sinal and payment status to Excel`
