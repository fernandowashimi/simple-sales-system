# Gestão de Vendas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A Windows desktop app (Electron) where one person catalogs plant products, records multi-item sales with free per-item prices, and browses/filters/groups/exports sales to Excel.

**Architecture:** electron-vite project. The main process owns a SQLite file (`node:sqlite`) and exposes a typed API to the React renderer through a preload `contextBridge`. Pure logic (name normalization, money, filters) lives in `src/shared` and `src/renderer/src/lib`, so Vitest can test it under plain Node. The UI is built from BoardUI components installed as source.

**Tech Stack:** Electron + electron-vite, React 19 + TypeScript, Tailwind v4 (`@tailwindcss/vite`), BoardUI (free components), `react-aria-components`, `@tanstack/react-table`, `node:sqlite` (built in), `exceljs`, Vitest, electron-builder (NSIS).

**Spec:** `docs/superpowers/specs/2026-11-19-gestao-de-vendas-design.md`

**Deviation from spec (builder's call, allowed by "Arquitetura"):** the spec names `better-sqlite3`. This plan uses **`node:sqlite`** instead. It is built into both Node 24 (Vitest) and Electron's Node, so there is no native module and no Electron-vs-Node ABI rebuild that would break tests on Windows. Task 1 verifies it loads in Electron's main process. If it doesn't, fall back to `better-sqlite3` + `@electron/rebuild`, and run DB tests via `ELECTRON_RUN_AS_NODE=1 electron node_modules/vitest/vitest.mjs`.

## Global Constraints

- Windows 10, Node 24, no Rust. The app must work fully offline: fonts are bundled, nothing is loaded from a CDN.
- UI copy is in Brazilian Portuguese. Money is shown as `R$ 1.234,56`. Dates are shown as `dd/mm/aaaa` and stored as ISO `YYYY-MM-DD`.
- Money is stored as integer centavos. Quantity is an integer > 0. Price is ≥ 0.
- DB file: `vendas.db` in `app.getPath('userData')`, with `PRAGMA foreign_keys = ON`.
- Security: `contextIsolation: true`, `nodeIntegration: false`, and the renderer never touches the DB directly.
- BoardUI rules (skill `boardui`):
  - Install real components with `npx boardui@latest add <name> --yes`.
  - Use semantic tokens only, never raw palette classes or `dark:` overrides.
  - Use composite type utilities (`text-body-medium` etc.).
  - Merge classes with `cx()` from `@/utils/cx`. Icons come from `@remixicon/react`.
- Visual polish follows skill `design-taste-frontend` (applied in Task 12). Do not invent animation timings; use `.claude/skills/boardui/references/motion.md`.
- Out of scope, so do not build:
  - stock
  - fixed product prices
  - buyer management screen
  - importing past sales
  - restore-from-backup UI
  - multi-user features

## Review Focus

1. **Local date vs UTC:** "today" defaults and date filters must use the *local* date. At 22:00 in Brazil (UTC-3), `new Date().toISOString()` is already tomorrow. Test: `todayISO(new Date(2026, 10, 19, 23, 30))` returns `'2026-11-19'` (Task 2).
2. **Price typing:** inputs `"R$ 1.234,56"`, `"45,5"`, `"45"`, `""`, `"-3"`, `"abc"` must parse to `123456`, `4550`, `4500`, `null`, `null`, `null` (Task 3).
3. **Rename collision through accents/case:** renaming "Jaca Sidhu" to `"jaca  sídhu"` when another "Jaca Sidhu" exists must throw `DuplicateNameError` with the existing name, never a raw SQLite error or a crash (Task 4).
4. **Editing a sale replaces items atomically:** saving an edit with fewer items removes the dropped ones. If any item is invalid, the old sale is left untouched (Task 5).
5. **Period filter is inclusive at both ends**, and sales without a buyer still pass a search for product text (Task 9).

---

### Task 1: Scaffold Electron + React + BoardUI, verify `node:sqlite`

**Files:**
- Create: the project via the template (root `package.json`, `electron.vite.config.ts`, `src/main/index.ts`, `src/preload/index.ts`, `src/renderer/index.html`, `src/renderer/src/main.tsx`, `src/renderer/src/App.tsx`)
- Create: `vitest.config.ts`, `.gitignore`
- Created by BoardUI init: `styles/`, `utils/cx.ts`, `components/`, `AGENTS.md`

**Interfaces:**
- Produces: `@` alias → project root (BoardUI imports such as `@/components/base/buttons/button` and `@/utils/cx` resolve). Scripts: `npm run dev`, `npm test`, `npm run build`.

- [ ] **Step 1:** In `C:\Users\Shinji\Documents\Projects\gestao-de-vendas`, scaffold with `npm create @quick-start/electron@latest . -- --template react-ts` (accept overwrite of the empty folder, keep `docs/` and `.claude/`). Then run `git init` and `npm install`.
- [ ] **Step 2:** Verify `node:sqlite` in Electron main. Temporarily add `import { DatabaseSync } from 'node:sqlite'; console.log('sqlite ok', new DatabaseSync(':memory:').prepare('select sqlite_version() v').get())` to `src/main/index.ts`, mark `node:sqlite` as external in the main build (`build.rollupOptions.external`), and run `npm run dev`. Expected: the terminal prints `sqlite ok { v: '3.x' }`. Remove the log. If it fails, apply the fallback described in the header and note it in the commit.
- [ ] **Step 3:** Initialize BoardUI at the project root: `npx boardui@latest init -y`.
  - Add `@tailwindcss/vite` to the renderer plugins in `electron.vite.config.ts`.
  - Set `resolve.alias['@'] = resolve(__dirname)` for the renderer, and add `"paths": { "@/*": ["./*"] }` to `tsconfig.web.json`.
  - Import `@/styles/globals.css` in `main.tsx`.
  - Install `@fontsource-variable/inter`, import it in `main.tsx`, and make sure `--font-inter` resolves to `'Inter Variable'` (check `styles/` for where the font variable is consumed).
- [ ] **Step 4:** Install the components used later: `npx boardui@latest add button icon-button input combobox checkbox select modal toast badge tabs date-picker date-range-picker sidebar data-table table --yes`.
- [ ] **Step 5:** Replace `App.tsx` content with a BoardUI `<Button>` on `bg-background-full`. Run `npm run dev`. Expected: the window shows a styled button in the Inter font, with no console errors.
- [ ] **Step 6:** Add Vitest (`npm i -D vitest`). Use `vitest.config.ts` with `test.environment = 'node'`, include `src/**/*.test.ts`, and set the same `@` alias. Add the script `"test": "vitest run"`. Run `npm test`. Expected: "No test files found" with exit 0 (add `passWithNoTests: true`).
- [ ] **Step 7: Commit** `chore: scaffold electron-vite + BoardUI`

---

### Task 2: Name normalization, keys, similarity, local date

**Files:**
- Create: `src/shared/names.ts`, `src/shared/dates.ts`
- Test: `src/shared/names.test.ts`, `src/shared/dates.test.ts`

**Interfaces:**
- Produces:
  - `normalizeName(raw: string): string`
  - `nameKey(raw: string): string`
  - `isSimilar(a: string, b: string): boolean` (args are raw names; compares keys)
  - `findSimilar<T extends { name: string }>(name: string, items: T[], max = 3): T[]`
  - `todayISO(now = new Date()): string`
  - `formatDateBR(iso: string): string`

- [ ] **Step 1: Write failing tests**

```ts
// names.test.ts
expect(nameKey(' João  Silva')).toBe('joao silva')
expect(normalizeName('jabuticaba branca gigante')).toBe('Jabuticaba Branca Gigante')
expect(normalizeName('Jaca rosa ES')).toBe('Jaca Rosa ES')
expect(normalizeName('Jabuticaba Sabará de cabinho')).toBe('Jabuticaba Sabará de Cabinho')
expect(normalizeName('de penca jabuticaba')).toBe('De Penca Jabuticaba') // connector first word
expect(normalizeName('Abiu Z4')).toBe('Abiu Z4')
expect(normalizeName('Jaca J-33')).toBe('Jaca J-33')
expect(normalizeName('  artocarpus   HIRSUTUS ')).toBe('Artocarpus HIRSUTUS') // all-caps ≥2 preserved per spec
expect(normalizeName('jaca e manga')).toBe('Jaca e Manga')
expect(isSimilar('João Si', 'João Silva')).toBe(true)   // prefix
expect(isSimilar('Joao Silvo', 'João Silva')).toBe(true) // distance 1
expect(isSimilar('Maria', 'João Silva')).toBe(false)
expect(findSimilar('joao', [{name:'João Silva'},{name:'João Souza'},{name:'Joana'},{name:'Joãozinho'},{name:'Pedro'}]).length).toBe(3)
// dates.test.ts
expect(todayISO(new Date(2026, 10, 19, 23, 30))).toBe('2026-11-19')
expect(formatDateBR('2026-11-05')).toBe('05/11/2026')
```

- [ ] **Step 2:** Run `npm test`. Expected: FAIL (modules missing).
- [ ] **Step 3:** Implement. Rules from the spec:
  - `nameKey`: trim, collapse whitespace, lowercase, NFD with diacritics removed (`/\p{Diacritic}/gu`).
  - `normalizeName`: trim and collapse whitespace. A word with `length >= 2 && word === word.toUpperCase() && /\p{L}|\d/u.test(word)` is kept as is. Connectors `de do da dos das e` become lowercase unless they are the first word. Every other word becomes first char upper + rest lower.
  - `isSimilar`: keys equal, one key `startsWith` the other, or Levenshtein ≤ 2. Write a small DP Levenshtein inline.
  - `todayISO`: built from `getFullYear/getMonth/getDate`, never `toISOString`.
- [ ] **Step 4:** Run `npm test`. Expected: PASS.
- [ ] **Step 5: Commit** `feat: name normalization, similarity, local dates`

---

### Task 3: Money parsing and formatting

**Files:**
- Create: `src/shared/money.ts`
- Test: `src/shared/money.test.ts`

**Interfaces:**
- Produces:
  - `parsePriceBR(input: string): number | null` (centavos, or null when invalid or empty)
  - `formatBRL(cents: number): string`

- [ ] **Step 1: Failing tests**

```ts
expect(parsePriceBR('R$ 1.234,56')).toBe(123456)
expect(parsePriceBR('45,5')).toBe(4550)
expect(parsePriceBR('45')).toBe(4500)
expect(parsePriceBR('0')).toBe(0)
expect(parsePriceBR('')).toBeNull()
expect(parsePriceBR('-3')).toBeNull()
expect(parsePriceBR('abc')).toBeNull()
expect(parsePriceBR('1,234')).toBeNull() // more than 2 decimals
expect(formatBRL(123456).replace(/\s/g, ' ')).toBe('R$ 1.234,56')
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Strip `R$` and spaces, remove `.` thousands separators, then match `/^\d+(,\d{1,2})?$/`. Convert to cents with integer math (never `parseFloat * 100`). `formatBRL` uses `Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })`.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat: BRL price parsing/formatting`

---

### Task 4: Database schema, products and buyers repository

**Files:**
- Create: `src/shared/types.ts`, `src/main/db/schema.ts`, `src/main/db/products.ts`
- Test: `src/main/db/products.test.ts`

**Interfaces:**
- Consumes: `normalizeName`, `nameKey` (Task 2).
- Produces:

```ts
// src/shared/types.ts
export type Product = { id: number; name: string }
export type Buyer = { id: number; name: string }
export type SaleItemInput = { productId: number; quantity: number; unitPriceCents: number }
export type SaleInput = { id?: number; buyerId: number | null; newBuyerName: string | null; date: string; shipped: boolean; items: SaleItemInput[] }
export type Sale = { id: number; buyerId: number | null; buyerName: string | null; date: string; shipped: boolean; items: (SaleItemInput & { productName: string })[] }
export type SaleRow = { saleId: number; itemId: number; date: string; buyerId: number | null; buyerName: string | null; productId: number; productName: string; quantity: number; unitPriceCents: number; subtotalCents: number; shipped: boolean }
```

- `openDb(path: string): DatabaseSync`: opens the DB, sets `PRAGMA foreign_keys = ON`, and creates the 4 tables exactly as in the spec's "Modelo de dados" (`CREATE TABLE IF NOT EXISTS`, plus an index on `sale_items(sale_id)`).
- `class DuplicateNameError extends Error { existingName: string }`. Message: `Já existe: ${existingName}`.
- `class ProductInUseError extends Error`. Message: `Produto já foi vendido; só é possível renomear.`
- `listProducts(db): Product[]` (ordered by `name_key`)
- `createProduct(db, name: string): Product`
- `renameProduct(db, id: number, name: string): Product`
- `deleteProduct(db, id: number): void`
- `listBuyers(db): Buyer[]`
- `findOrCreateBuyer(db, name: string): number` (used inside the sale transaction)

- [ ] **Step 1: Failing tests** (each test uses `openDb(':memory:')`)

```ts
test('createProduct normalizes and stores key', () => { expect(createProduct(db, ' jaca  sidhu ').name).toBe('Jaca Sidhu') })
test('duplicate by accent/case throws DuplicateNameError', () => {
  createProduct(db, 'Jaca Sidhu')
  expect(() => createProduct(db, 'JACA SÍDHU')).toThrow(DuplicateNameError) // note: 'SÍDHU' stays caps per rule but key collides
})
test('rename collision reports existing name', () => {
  createProduct(db, 'Jaca Sidhu'); const b = createProduct(db, 'Jaca King')
  try { renameProduct(db, b.id, 'jaca  sídhu'); fail() } catch (e) { expect((e as DuplicateNameError).existingName).toBe('Jaca Sidhu') }
})
test('rename to same key of itself is allowed', () => { const p = createProduct(db, 'Jaca king'); expect(renameProduct(db, p.id, 'JACA king').id).toBe(p.id) })
test('findOrCreateBuyer reuses by key', () => { expect(findOrCreateBuyer(db, 'joão silva')).toBe(findOrCreateBuyer(db, 'Joao  Silva')) })
```

(Add the `deleteProduct` → `ProductInUseError` test in Task 5, once sales exist.)

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement with `db.prepare(...)`. Detect duplicates with a `SELECT name FROM products WHERE name_key = ? AND id != ?` before writing. Keep the UNIQUE constraint as a backstop, and map a `SQLITE_CONSTRAINT_UNIQUE` error to `DuplicateNameError` too. `deleteProduct` checks `sale_items` first.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat: sqlite schema, products and buyers repo`

---

### Task 5: Sales repository (atomic save, edit, delete, rows)

**Files:**
- Create: `src/main/db/sales.ts`
- Test: `src/main/db/sales.test.ts`

**Interfaces:**
- Consumes: `openDb`, `findOrCreateBuyer`, `deleteProduct`, `ProductInUseError` (Task 4), and the types.
- Produces:
  - `saveSale(db, input: SaleInput): number` (returns the sale id)
  - `getSale(db, id: number): Sale | null`
  - `deleteSale(db, id: number): void`
  - `listSaleRows(db): SaleRow[]` (ordered by `date DESC, sale id DESC, item id ASC`)
  - `class ValidationError extends Error`

- [ ] **Step 1: Failing tests**

```ts
test('saves sale with new buyer in one go', () => {
  const p = createProduct(db, 'Jaca Sidhu')
  const id = saveSale(db, { buyerId: null, newBuyerName: 'joão silva', date: '2026-11-19', shipped: false, items: [{ productId: p.id, quantity: 2, unitPriceCents: 4500 }] })
  expect(getSale(db, id)).toMatchObject({ buyerName: 'João Silva', items: [{ productName: 'Jaca Sidhu', quantity: 2, unitPriceCents: 4500 }] })
})
test('sale without buyer allowed', ...)                       // buyerId null, newBuyerName null → buyerName null
test('rejects empty items / qty 0 / negative price / bad date with ValidationError and writes nothing', ...)
test('edit replaces items atomically', () => {
  // save with 2 items, then save {id, items:[one]} → getSale has 1 item
  // then save {id, items:[{productId: 9999,...}]} → throws, getSale still has the 1 item, buyers table unchanged
})
test('invalid sale with newBuyerName does not leave an orphan buyer', ...)
test('listSaleRows computes subtotalCents = quantity*unitPriceCents', ...)
test('deleteProduct used in sale throws ProductInUseError', ...)
test('deleteSale cascades items', ...)
```

- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement. Validate first: at least one item, `Number.isInteger(quantity) && quantity > 0`, integer price ≥ 0, date matches `/^\d{4}-\d{2}-\d{2}$/`. Then run `db.exec('BEGIN')` and, inside try/`COMMIT`/catch, `ROLLBACK` and rethrow. Resolve the buyer: `buyerId ?? (newBuyerName ? findOrCreateBuyer(...) : null)`. For an edit, `UPDATE sales` + `DELETE FROM sale_items WHERE sale_id = ?`, then insert the items.
- [ ] **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat: sales repository with atomic save`

---

### Task 6: Seed products from the CSV

**Files:**
- Create: `resources/produtos-seed.csv` (UTF-8 copy of the source CSV), `src/main/db/seed.ts`
- Test: `src/main/db/seed.test.ts`

**Interfaces:**
- Consumes: `createProduct`, `nameKey`.
- Produces:
  - `parseSeedCsv(text: string): string[]`: names from column 1. Skips the header, blank lines and empty names. Ignores the other columns.
  - `seedProductsIfEmpty(db, names: string[]): number` (count inserted; skips duplicates by key)

- [ ] **Step 1:** Convert the source to UTF-8 with Node: `node -e "require('fs').writeFileSync('resources/produtos-seed.csv', new TextDecoder('windows-1252').decode(require('fs').readFileSync(process.argv[1])))" "C:/Users/Shinji/Downloads/Produtos Fructus Viveiro.CSV"`. Check that the file contains `Abiu Solimões` and `Jabuticaba açu Canaã` (or the source's spelling) with correct accents.
- [ ] **Step 2: Failing tests**

```ts
expect(parseSeedCsv('Nome do produto;Quantidade;;;\nAbiu E4;3;;;\n\nRambutam hermafrodita;3;;;8\n;;;;\n')).toEqual(['Abiu E4', 'Rambutam hermafrodita'])
test('seeds real file: 142 names, no duplicates, accents intact', () => {
  const names = parseSeedCsv(readFileSync('resources/produtos-seed.csv', 'utf8'))
  expect(names).toHaveLength(142)
  expect(seedProductsIfEmpty(db, names)).toBe(142)
  expect(listProducts(db).some(p => p.name === 'Abiu Solimões')).toBe(true)
})
test('second seed is a no-op', () => { seedProductsIfEmpty(db, ['X']); expect(seedProductsIfEmpty(db, ['Y'])).toBe(0) })
```

- [ ] **Step 3:** Run. Expected: FAIL.
- [ ] **Step 4:** Implement. Strip a BOM. Split lines on `\r?\n`, take the first `;` field and trim it. `seedProductsIfEmpty` returns 0 if any product exists. Otherwise it inserts inside one transaction and catches `DuplicateNameError` per name.
- [ ] **Step 5:** Run. Expected: PASS. **Commit** `feat: seed products from CSV`

---

### Task 7: Excel export and backup

**Files:**
- Create: `src/main/exportXlsx.ts`, `src/main/backup.ts`
- Test: `src/main/exportXlsx.test.ts`, `src/main/backup.test.ts`

**Interfaces:**
- Consumes: `SaleRow`.
- Produces:
  - `buildSalesWorkbook(rows: SaleRow[]): Promise<Buffer>`
  - `backupDb(db: DatabaseSync, destPath: string): Promise<void>`

- [ ] **Step 1: Failing tests**
  - Export: build from 2 rows, read back with `new ExcelJS.Workbook().xlsx.load(buf)`, and check:
    - sheet `Vendas`
    - header row `['Data','Comprador','Produto','Qtd','Preço unit.','Subtotal','Enviado']`
    - row 2 col 1 is a `Date` equal to local 2026-11-19
    - col 5 = `45` (reais as a number) with `numFmt` containing `R$`
    - col 7 = `'Sim'`/`'Não'`
    - a null buyer becomes `''`
    - zero rows still produce the header
  - Backup: back up a file DB with one product to a temp path, open the copy with `openDb`, and check `listProducts` has the product.
- [ ] **Step 2:** Run. Expected: FAIL.
- [ ] **Step 3:** Implement.
  - Export: `npm i exceljs`. Build dates with `new Date(y, m-1, d)`. Price = `cents/100`, `numFmt = '"R$" #,##0.00'`. Set column widths and bold the header.
  - Backup: use `backup(db, destPath)` from `node:sqlite`.
- [ ] **Step 4:** Run. Expected: PASS. **Commit** `feat: xlsx export and db backup`

---

### Task 8: IPC bridge and app bootstrap

**Files:**
- Create: `src/main/ipc.ts`
- Modify: `src/main/index.ts`, `src/preload/index.ts`, `src/preload/index.d.ts`

**Interfaces:**
- Consumes: everything from Tasks 4–7.
- Produces `window.api` (typed in `index.d.ts`). Each method returns a Promise and rejects with `Error(message)` carrying the friendly message:

```ts
products: { list(): Promise<Product[]>; create(name: string): Promise<Product>; rename(id: number, name: string): Promise<Product>; remove(id: number): Promise<void> }
buyers:   { list(): Promise<Buyer[]> }
sales:    { save(input: SaleInput): Promise<number>; get(id: number): Promise<Sale | null>; remove(id: number): Promise<void>; rows(): Promise<SaleRow[]>; exportXlsx(rows: SaleRow[]): Promise<boolean> } // false = dialog cancelled
db:       { backup(): Promise<boolean>; path(): Promise<string> }
```

- [ ] **Step 1:** In `ipc.ts`, register `ipcMain.handle('<area>:<method>')` for each method. Wrap each handler so it returns `{ ok: true, data } | { ok: false, error: e.message }`, because Electron mangles thrown messages. The preload unwraps the result and throws `new Error(error)`.
  - `exportXlsx` shows `dialog.showSaveDialog` with `defaultPath: vendas-${todayISO()}.xlsx`, filters `xlsx`, then writes the buffer.
  - `backup` shows a save dialog with default `vendas-backup-${todayISO()}.db`.
- [ ] **Step 2:** In `index.ts`, on `app.whenReady`:
  - `openDb(join(app.getPath('userData'), 'vendas.db'))`
  - `seedProductsIfEmpty(db, parseSeedCsv(readFileSync(seedPath, 'utf8')))`. `seedPath` is `join(process.resourcesPath, 'produtos-seed.csv')` when packaged and `join(app.getAppPath(), 'resources/produtos-seed.csv')` in dev.
  - `registerIpc(db)`, then create the window (title "Gestão de Vendas", min size 1100×700).
- [ ] **Step 3:** Run `npm run dev`. In the DevTools console, `await window.api.products.list()` should return 142 products with normalized names. `await window.api.products.create('jaca sidhu')` should reject with message `Já existe: Jaca Sidhu`.
- [ ] **Step 4: Commit** `feat: ipc bridge and db bootstrap`

---

### Task 9: Sales filters (pure)

**Files:**
- Create: `src/renderer/src/lib/filters.ts`
- Test: `src/renderer/src/lib/filters.test.ts`

**Interfaces:**
- Consumes: `SaleRow`, `nameKey`.
- Produces:
  - `type SalesFilters = { search: string; from: string | null; to: string | null; shipped: 'all' | 'yes' | 'no'; productIds: number[]; buyerIds: number[] }`
  - `emptyFilters: SalesFilters`
  - `filterRows(rows: SaleRow[], f: SalesFilters): SaleRow[]`

- [ ] **Step 1: Failing tests**

```ts
// rows on 2026-11-01, 2026-11-10, 2026-11-19; one with buyerName null, product 'Jaca Sidhu'
expect(filterRows(rows, { ...emptyFilters, from: '2026-11-01', to: '2026-11-19' })).toHaveLength(3) // inclusive both ends
expect(filterRows(rows, { ...emptyFilters, search: 'sidhu' }).map(r => r.buyerName)).toContain(null) // null buyer still searchable by product
expect(filterRows(rows, { ...emptyFilters, search: 'JOAO' })).toEqual(rowsOf('João Silva'))         // accent/case-insensitive
expect(filterRows(rows, { ...emptyFilters, shipped: 'no' }).every(r => !r.shipped)).toBe(true)
expect(filterRows(rows, { ...emptyFilters, productIds: [p1], buyerIds: [b1] })) // AND between fields, OR within a list
```

- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement (compare ISO strings directly). **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: Commit** `feat: sales row filters`

---

### Task 10: App shell and Products page

**Files:**
- Modify: `src/renderer/src/App.tsx`
- Create: `src/renderer/src/pages/ProductsPage.tsx`

**Interfaces:**
- Consumes: `window.api.products`, BoardUI `sidebar`, `input`, `button`, `table`, `modal`, `toast`.
- Produces: `type Page = { name: 'sales' } | { name: 'new-sale' } | { name: 'edit-sale'; saleId: number } | { name: 'products' }`. `App` holds `page` state and passes `navigate(page: Page)` to pages. No router: three screens don't need one.

- [ ] **Step 1:** Adapt the installed `DashboardSidebar` to show only the three nav items (Vendas, Nova venda, Produtos) plus a footer "Fazer backup" action (`window.api.db.backup()`, with a success toast). Below it, show the DB file location from `window.api.db.path()` in `text-caption-1-regular text-text-tertiary` (the spec requires it to be visible for manual restore). Remove the team/user/announcement parts from the copied source. Mount the BoardUI `Toaster` once.
- [ ] **Step 2:** On ProductsPage, show a search `Input` (filters by `nameKey` contains), a "Novo produto" button, and a BoardUI `table` with name and actions.
  - Editing a name inline: Enter saves via `rename`, Esc cancels.
  - The new-product row works the same way.
  - Errors from the API show as an error toast with the message (e.g. `Já existe: Jaca Sidhu`).
  - Delete asks for confirmation in a `modal`, then calls `remove`. `ProductInUseError` shows as a toast.
- [ ] **Step 3:** Run `npm run dev` and check:
  - 142 products are listed.
  - Searching "sidhu" finds "Jaca Sidhu".
  - Creating "jaca sidhu" shows the duplicate toast.
  - Renaming "Artocapus Lanceifolius" to "Artocarpus lanceifolius" saves as "Artocarpus Lanceifolius".
  - Deleting an unsold product works.
- [ ] **Step 4: Commit** `feat: app shell and products page`

---

### Task 11: Sale form (new/edit) with buyer warning

**Files:**
- Create: `src/renderer/src/pages/SaleFormPage.tsx`, `src/renderer/src/components/BuyerField.tsx`, `src/renderer/src/components/SaleItemsEditor.tsx`, `src/renderer/src/components/SimilarBuyerModal.tsx`
- Create: `src/renderer/src/lib/saleForm.ts` + `saleForm.test.ts`

**Interfaces:**
- Consumes: `window.api.{products,buyers,sales}`, `parsePriceBR`, `formatBRL`, `todayISO`, `findSimilar`, `nameKey`, BoardUI `combobox`, `input`, `checkbox`, `date-picker`, `modal`, `button`, `toast`.
- Produces:
  - `type ItemDraft = { productId: number | null; quantity: string; price: string }`
  - `toSaleInput(draft: { id?: number; buyerText: string; buyerId: number | null; date: string; shipped: boolean; items: ItemDraft[] }, buyers: Buyer[]): { input: SaleInput } | { error: string }`
  - `resolveBuyer(buyerText: string, buyerId: number | null, buyers: Buyer[]): { buyerId: number | null; newBuyerName: string | null }`

- [ ] **Step 1: Failing tests (`saleForm.test.ts`)**

```ts
expect(resolveBuyer('  ', null, buyers)).toEqual({ buyerId: null, newBuyerName: null })
expect(resolveBuyer('joao silva', null, [{ id: 1, name: 'João Silva' }])).toEqual({ buyerId: 1, newBuyerName: null }) // exact key match reuses
expect(resolveBuyer('João Si', null, [{ id: 1, name: 'João Silva' }])).toEqual({ buyerId: null, newBuyerName: 'João Si' })
// toSaleInput drops the trailing blank row, rejects no items, qty '0'/'1,5', bad price, product null in a filled row
expect(toSaleInput({ ...base, items: [{ productId: 1, quantity: '2', price: '45' }, { productId: null, quantity: '', price: '' }] }, buyers))
  .toEqual({ input: { ...expected, items: [{ productId: 1, quantity: 2, unitPriceCents: 4500 }] } })
expect(toSaleInput({ ...base, items: [] }, buyers)).toEqual({ error: 'Adicione pelo menos um produto.' })
```

- [ ] **Step 2:** Run. Expected: FAIL. **Step 3:** Implement `saleForm.ts`. **Step 4:** Run. Expected: PASS.
- [ ] **Step 5: UI**, following the spec's "Nova venda" sketch and rules.
  - **BuyerField:** a `ComboBox` with `allowsCustomValue`. Items are filtered by `nameKey` contains. When the text matches no buyer, show a last item `+ Cadastrar "<texto>" ao salvar`.
  - **Date:** a `DatePicker` defaulting to `todayISO()`. **Enviado:** a `Checkbox`.
  - **SaleItemsEditor:** product `ComboBox` (existing products only), Qtd `Input`, Preço `Input`, subtotal, and a remove `IconButton`. There is always one trailing blank row.
  - **Keyboard flow:** Enter selects the product, Tab goes to Qtd and then Preço, Enter in Preço focuses the next row's product.
  - The total is shown with `formatBRL`.
- [ ] **Step 6: Save flow.**
  - If `toSaleInput` returns an error, show it as a toast.
  - If `newBuyerName` is set and `findSimilar(newBuyerName, buyers)` is non-empty, open `SimilarBuyerModal`. It lists up to 3 matches, with the first one focused and Enter choosing it. A button `Cadastrar "<nome>"` creates the new buyer, and Esc returns to the form.
  - Then `sales.save`. For a new sale, reset the form, show the toast "Venda salva", and focus Comprador. For an edit, navigate back to Vendas.
  - In edit mode, load with `sales.get(saleId)` and show an "Excluir venda" button behind a confirm modal.
- [ ] **Step 7:** Run `npm run dev` and check, mouse-free:
  - A sale with 2 items saves.
  - Typing "João Si" when "João Silva" exists shows the warning, and Enter reuses João Silva.
  - A buyer with no similar name is created without a warning.
  - Editing removes an item correctly.
- [ ] **Step 8: Commit** `feat: sale form with buyer similarity warning`

---

### Task 12: Sales table, grouping, export, packaging, polish

**Files:**
- Create: `src/renderer/src/pages/SalesPage.tsx`
- Modify: `package.json` / `electron-builder.yml`

**Interfaces:**
- Consumes: `window.api.sales.rows/exportXlsx`, `filterRows`, `emptyFilters`, `formatBRL`, `formatDateBR`, `@tanstack/react-table` (installed with `data-table`), BoardUI `table`, `input`, `select`, `date-range-picker`, `combobox`, `button`, `badge`.

- [ ] **Step 1:** Build the toolbar following the spec's "Vendas" sketch:
  - search `Input`
  - `DateRangePicker` → `from`/`to` (local ISO)
  - Enviado `Select` (Todos/Sim/Não)
  - Produtos and Compradores multi-select (a `ComboBox` adding removable `Badge`s)
  - "Agrupar por" `Select` (Nenhum/Produto/Comprador/Data)
  - a "Limpar filtros" link
- [ ] **Step 2:** Build the table: `useReactTable` over `filterRows(rows, filters)` with `getSortedRowModel`, `getGroupedRowModel` and `getExpandedRowModel`, rendered with BoardUI `table` primitives (start from the installed `data-table` source and drop selection/pagination).
  - Columns: Data, Comprador ("—" when null), Produto, Qtd, Preço unit., Subtotal, Enviado (`Badge`).
  - Default sort: date desc. The Data, Comprador and Produto headers are clickable to sort.
  - Group rows show the label, the item count, the sum of Qtd and the sum of Subtotal (`aggregationFn: 'sum'`), and start expanded.
  - A footer shows the totals of the filtered rows.
  - Clicking a row calls `navigate({ name: 'edit-sale', saleId })`.
  - Empty state: "Nenhuma venda encontrada" plus a "Nova venda" button.
- [ ] **Step 3:** Add an "Exportar Excel" button with a menu offering **Tudo** (all rows sorted date desc) or **Filtrado** (`table.getPrePaginationRowModel().flatRows` leaf rows in the current sort order, groups flattened). Pass the rows to `sales.exportXlsx`. Show a success toast unless cancelled.
- [ ] **Step 4:** Run `npm run dev` and check:
  - With 3+ sales across 2 buyers, group by Comprador and confirm the sums.
  - Filter the period to one day and confirm boundary rows appear.
  - Export Filtrado and open the file in Excel: only the filtered rows, with dates as dates and prices as R$ numbers.
- [ ] **Step 5: Polish.** Run a pass with skill `design-taste-frontend` and the BoardUI verify checklist:
  - no raw palette classes or `dark:` overrides, `cx()` everywhere
  - consistent spacing and type
  - dark mode via the `theme-toggle` component if it was installed
- [ ] **Step 6: Package.**
  - Configure electron-builder: `appId: br.com.fructus.vendas`, `productName: Gestão de Vendas`, `win.target: nsis`, `extraResources: [{ from: resources/produtos-seed.csv, to: produtos-seed.csv }]`.
  - Run `npm run build:win`. Expected: `dist/*Setup*.exe`.
  - Install it, launch, and confirm 142 products appear and the data persists after restart.
- [ ] **Step 7:** Run `npm test`. Expected: all pass. **Commit** `feat: sales table, export, packaging`
