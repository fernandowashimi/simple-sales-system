import { RiCloseLine } from '@remixicon/react'
import { cx } from '@/utils/cx'
import { Button } from '@/components/base/buttons/button'
import { ComboBox, ComboBoxItem } from '@/components/base/combobox/combobox'
import { Input } from '@/components/base/input/input'
import type { Product } from '../../../shared/types'
import { nameKey } from '../../../shared/names'
import { formatBRL, formatPriceInput, parsePriceBR } from '../../../shared/money'
import { itemSubtotal, withTrailingBlank, type ItemDraft } from '../lib/saleForm'

const focusField = (row: number, field: 'product' | 'qty' | 'price'): void => {
  requestAnimationFrame(() => document.querySelector<HTMLInputElement>(`[data-row="${row}"] [data-field="${field}"] input`)?.focus())
}

/** Key of the first visible option when the user presses Enter without arrowing into the list. */
export function firstOptionKey(input: HTMLInputElement): string | null {
  const list = document.getElementById(input.getAttribute('aria-controls') ?? '')
  if (!list || list.querySelector('[role=option][data-focused]')) return null
  return list.querySelector<HTMLElement>('[role=option]')?.dataset.key ?? null
}


const GRID = 'grid grid-cols-[minmax(0,1fr)_96px_140px_120px_36px] items-start gap-3'

export function SaleItemsEditor({ products, items, onChange }: { products: Product[]; items: ItemDraft[]; onChange: (items: ItemDraft[]) => void }): React.JSX.Element {
  const rows = withTrailingBlank(items)

  const update = (i: number, patch: Partial<ItemDraft>): void => {
    const next = rows.map((it, j) => (j === i ? { ...it, ...patch } : it))
    onChange(withTrailingBlank(next))
  }
  const remove = (i: number): void => onChange(withTrailingBlank(rows.filter((_, j) => j !== i)))

  return (
    <div className="flex flex-col gap-2">
      <div className={cx(GRID, 'px-1 text-caption-1-medium text-text-tertiary')}>
        <span>Produto</span>
        <span>Qtd</span>
        <span>Preço unit.</span>
        <span className="text-right">Subtotal</span>
        <span />
      </div>
      {rows.map((it, i) => {
        const sub = itemSubtotal(it)
        const last = i === rows.length - 1
        return (
          <div key={it.uid ?? i} data-row={i} className={GRID}>
            <div
              data-field="product"
              onKeyDownCapture={(e) => {
                if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return
                const key = firstOptionKey(e.target)
                if (key == null) return
                e.preventDefault()
                e.stopPropagation()
                update(i, { productId: Number(key) })
                focusField(i, 'qty')
              }}
            >
              <ComboBox<Product>
                aria-label={`Produto da linha ${i + 1}`}
                placeholder="Buscar produto…"
                emptyMessage="Nenhum produto encontrado"
                defaultItems={products}
                defaultFilter={(text, input) => nameKey(text).includes(nameKey(input))}
                selectedKey={it.productId}
                menuTrigger="input"
                onSelectionChange={(key) => {
                  update(i, { productId: key == null ? null : Number(key) })
                  if (key != null) focusField(i, 'qty')
                }}
              >
                {(p) => (
                  <ComboBoxItem id={p.id} textValue={p.name}>
                    <span className="truncate">{p.name}</span>
                  </ComboBoxItem>
                )}
              </ComboBox>
            </div>
            <div data-field="qty">
              <Input aria-label={`Quantidade da linha ${i + 1}`} inputMode="numeric" placeholder="0" value={it.quantity}
                onChange={(quantity) => update(i, { quantity })}
                onKeyDown={(e) => {
                  // Enter moves on to the price instead of submitting the whole sale
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    focusField(i, 'price')
                  }
                }}
              />
            </div>
            <div data-field="price">
              <Input
                aria-label={`Preço unitário da linha ${i + 1}`}
                inputMode="decimal"
                placeholder="0,00"
                leadingAddon={<span className="text-body-medium text-text-tertiary">R$</span>}
                value={it.price}
                onChange={(price) => update(i, { price })}
                onBlur={() => {
                  const cents = parsePriceBR(it.price)
                  if (cents != null) update(i, { price: formatPriceInput(cents) })
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    focusField(i + 1, 'product')
                  }
                }}
              />
            </div>
            <span className="flex h-9 items-center justify-end text-body-medium tabular-nums text-text-primary">{sub != null ? formatBRL(sub) : '—'}</span>
            {last ? <span /> : <Button variant="ghost" iconOnly leadingIcon={RiCloseLine} aria-label={`Remover linha ${i + 1}`} onClick={() => remove(i)} />}
          </div>
        )
      })}
    </div>
  )
}
