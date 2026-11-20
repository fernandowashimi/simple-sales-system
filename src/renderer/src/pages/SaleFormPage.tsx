import { useEffect, useMemo, useState } from 'react'
import { RiDeleteBinLine, RiSaveLine } from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { Checkbox } from '@/components/base/checkbox/checkbox'
import { DatePicker } from '@/components/base/date-picker/date-picker'
import { Label } from '@/components/base/input/label'
import { AlertDialog } from '@/components/base/modal/modal'
import { toast } from '@/components/base/toast/toast'
import type { Buyer, Product, SaleInput } from '../../../shared/types'
import { todayISO } from '../../../shared/dates'
import { findSimilar } from '../../../shared/names'
import { formatBRL } from '../../../shared/money'
import type { Page } from '../App'
import { BuyerField } from '../components/BuyerField'
import { Card, PageHeader } from '../components/PageHeader'
import { itemSubtotal, SaleItemsEditor } from '../components/SaleItemsEditor'
import { SimilarBuyerModal } from '../components/SimilarBuyerModal'
import { calendarToIso, isoToCalendar } from '../lib/i18n'
import { toSaleInput, type SaleDraft } from '../lib/saleForm'

const emptyDraft = (): SaleDraft => ({ buyerText: '', buyerId: null, date: todayISO(), shipped: false, items: [] })

export function SaleFormPage({ saleId, navigate }: { saleId?: number; navigate: (p: Page) => void }): React.JSX.Element {
  const [products, setProducts] = useState<Product[]>([])
  const [buyers, setBuyers] = useState<Buyer[]>([])
  const [draft, setDraft] = useState<SaleDraft>(emptyDraft)
  const [pending, setPending] = useState<{ input: SaleInput; matches: Buyer[] } | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [saving, setSaving] = useState(false)
  const isEdit = saleId != null

  useEffect(() => {
    window.api.products.list().then(setProducts)
    window.api.buyers.list().then(setBuyers)
    if (saleId != null)
      window.api.sales.get(saleId).then((s) => {
        if (!s) return navigate({ name: 'sales' })
        setDraft({
          id: s.id,
          buyerText: s.buyerName ?? '',
          buyerId: s.buyerId,
          date: s.date,
          shipped: s.shipped,
          items: s.items.map((it) => ({ productId: it.productId, quantity: String(it.quantity), price: (it.unitPriceCents / 100).toFixed(2).replace('.', ',') }))
        })
      })
  }, [saleId, navigate])

  const total = useMemo(() => draft.items.reduce((sum, it) => sum + (itemSubtotal(it) ?? 0), 0), [draft.items])

  const persist = async (input: SaleInput): Promise<void> => {
    setSaving(true)
    try {
      await window.api.sales.save(input)
      if (isEdit) {
        toast.success('Venda atualizada')
        navigate({ name: 'sales' })
      } else {
        toast.success('Venda salva', { description: `Total ${formatBRL(total)}` })
        setDraft(emptyDraft())
        setBuyers(await window.api.buyers.list())
        requestAnimationFrame(() => document.querySelector<HTMLInputElement>('[data-field="buyer"] input')?.focus())
      }
    } catch (e) {
      toast.error('Não foi possível salvar', { description: (e as Error).message })
    } finally {
      setSaving(false)
    }
  }

  const submit = (): void => {
    const r = toSaleInput(draft, buyers)
    if ('error' in r) return void toast.error(r.error)
    const matches = r.input.newBuyerName ? findSimilar(r.input.newBuyerName, buyers) : []
    if (matches.length > 0) setPending({ input: r.input, matches })
    else persist(r.input)
  }

  const remove = async (): Promise<void> => {
    if (saleId == null) return
    await window.api.sales.remove(saleId)
    toast.success('Venda excluída')
    navigate({ name: 'sales' })
  }

  return (
    <div className="mx-auto flex max-w-5xl flex-col">
      <PageHeader
        title={isEdit ? 'Editar venda' : 'Nova venda'}
        description={isEdit ? undefined : 'Digite o produto, Enter, quantidade, preço e Enter para a próxima linha.'}
        actions={
          isEdit && (
            <Button variant="secondary" leadingIcon={RiDeleteBinLine} onClick={() => setConfirmDelete(true)}>
              Excluir venda
            </Button>
          )
        }
      />
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          submit()
        }}
      >
        <Card className="grid grid-cols-[minmax(0,1fr)_200px_auto] items-end gap-4">
          <div data-field="buyer">
            <BuyerField buyers={buyers} text={draft.buyerText} buyerId={draft.buyerId} onChange={(buyerText, buyerId) => setDraft((d) => ({ ...d, buyerText, buyerId }))} />
          </div>
          <div className="flex flex-col gap-1">
            <Label>Data</Label>
            <DatePicker aria-label="Data da venda" value={isoToCalendar(draft.date)} onChange={(v) => v && setDraft((d) => ({ ...d, date: calendarToIso(v)! }))} className="w-full" />
          </div>
          <div className="flex h-9 items-center">
            <Checkbox isSelected={draft.shipped} onChange={(shipped) => setDraft((d) => ({ ...d, shipped }))}>
              Enviado
            </Checkbox>
          </div>
        </Card>
        <Card>
          <SaleItemsEditor products={products} items={draft.items} onChange={(items) => setDraft((d) => ({ ...d, items }))} />
        </Card>
        <div className="flex items-center justify-end gap-5 px-1">
          <div className="flex items-baseline gap-2">
            <span className="text-body-medium text-text-secondary">Total</span>
            <span className="text-title-3-semibold tabular-nums text-text-primary">{formatBRL(total)}</span>
          </div>
          <Button type="submit" leadingIcon={RiSaveLine} disabled={saving}>
            {isEdit ? 'Salvar alterações' : 'Salvar venda'}
          </Button>
        </div>
      </form>

      <SimilarBuyerModal
        newName={pending?.input.newBuyerName ?? null}
        matches={pending?.matches ?? []}
        onCancel={() => setPending(null)}
        onUseExisting={(b) => {
          const input = { ...pending!.input, buyerId: b.id, newBuyerName: null }
          setPending(null)
          setDraft((d) => ({ ...d, buyerText: b.name, buyerId: b.id }))
          persist(input)
        }}
        onCreateNew={() => {
          const input = pending!.input
          setPending(null)
          persist(input)
        }}
      />
      <AlertDialog
        isOpen={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Excluir venda?"
        description="A venda e todos os seus itens serão removidos. Isso não pode ser desfeito."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={remove}
      />
    </div>
  )
}
