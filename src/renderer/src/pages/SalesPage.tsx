import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from 'react'
import {
  createColumnHelper,
  getCoreRowModel,
  getExpandedRowModel,
  getGroupedRowModel,
  getSortedRowModel,
  useReactTable,
  type ExpandedState,
  type GroupingState,
  type SortingState
} from '@tanstack/react-table'
import { RiAddLine, RiArrowDownSLine, RiArrowRightSLine, RiArrowUpSLine, RiCloseLine, RiFileExcel2Line, RiSearchLine } from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { Chip } from '@/components/base/badges/chip'
import { ComboBox, ComboBoxItem } from '@/components/base/combobox/combobox'
import { DateRangePicker } from '@/components/base/date-picker/date-range-picker'
import { Dropdown, DropdownItem, DropdownPopover, DropdownTrigger } from '@/components/base/dropdown/dropdown'
import { buttonStyles } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { Select, SelectItem } from '@/components/base/select/select'
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@/components/base/table/table'
import { toast } from '@/components/base/toast/toast'
import { cx } from '@/utils/cx'
import type { SaleRow } from '../../../shared/types'
import { formatDateBR } from '../../../shared/dates'
import { formatBRL } from '../../../shared/money'
import { nameKey } from '../../../shared/names'
import type { Page } from '../App'
import { Card, PageHeader } from '../components/PageHeader'
import { emptyFilters, filterRows, type SalesFilters } from '../lib/filters'
import { calendarToIso, isoToCalendar } from '../lib/i18n'

const col = createColumnHelper<SaleRow>()
const columns = [
  col.accessor('date', { header: 'Data', cell: (c) => formatDateBR(c.getValue()) }),
  col.accessor((r) => r.buyerName ?? '—', { id: 'buyerName', header: 'Comprador' }),
  col.accessor('productName', { header: 'Produto' }),
  col.accessor('quantity', { header: 'Qtd', aggregationFn: 'sum', enableSorting: false }),
  col.accessor('unitPriceCents', { header: 'Preço unit.', cell: (c) => formatBRL(c.getValue()), enableSorting: false, aggregationFn: () => null }),
  col.accessor('subtotalCents', { header: 'Subtotal', cell: (c) => formatBRL(c.getValue()), aggregationFn: 'sum', enableSorting: false }),
  col.accessor('shipped', { header: 'Enviado', enableSorting: false, aggregationFn: () => null })
]
const plural = (n: number): string => `${n} ${n === 1 ? 'item' : 'itens'}`
const NUMERIC = new Set(['quantity', 'unitPriceCents', 'subtotalCents'])

type GroupKey = 'none' | 'productName' | 'buyerName' | 'date'
const GROUP_LABEL: Record<GroupKey, string> = { none: 'Nenhum', productName: 'Produto', buyerName: 'Comprador', date: 'Data' }

function IdFilter({ label, options, selected, onChange }: { label: string; options: { id: number; name: string }[]; selected: number[]; onChange: (ids: number[]) => void }): React.JSX.Element {
  const [text, setText] = useState('')
  const available = useMemo(() => options.filter((o) => !selected.includes(o.id) && nameKey(o.name).includes(nameKey(text))), [options, selected, text])
  return (
    <ComboBox<{ id: number; name: string }>
      aria-label={label}
      placeholder={label}
      size="small"
      items={available}
      inputValue={text}
      onInputChange={setText}
      selectedKey={null}
      emptyMessage="Nada encontrado"
      onSelectionChange={(key) => {
        if (key == null) return
        onChange([...selected, Number(key)])
        setText('')
      }}
      className="w-56"
    >
      {(o) => (
        <ComboBoxItem id={o.id} textValue={o.name}>
          <span className="truncate">{o.name}</span>
        </ComboBoxItem>
      )}
    </ComboBox>
  )
}

export type SalesView = { filters: SalesFilters; group: GroupKey; sorting: SortingState; expanded: ExpandedState }
export const defaultSalesView: SalesView = { filters: emptyFilters, group: 'none', sorting: [{ id: 'date', desc: true }], expanded: true }

/** Setter for one field of the view, accepting a value or an updater like useState/TanStack do. */
function fieldSetter<K extends keyof SalesView>(setView: Dispatch<SetStateAction<SalesView>>, key: K) {
  return (u: SalesView[K] | ((old: SalesView[K]) => SalesView[K])): void =>
    setView((v) => ({ ...v, [key]: typeof u === 'function' ? (u as (old: SalesView[K]) => SalesView[K])(v[key]) : u }))
}

export function SalesPage({ navigate, viewState }: { navigate: (p: Page) => void; viewState: [SalesView, Dispatch<SetStateAction<SalesView>>] }): React.JSX.Element {
  const [rows, setRows] = useState<SaleRow[]>([])
  // view state lives in App so filters/grouping survive opening a sale to edit it
  const [{ filters, group, sorting, expanded }, setView] = viewState
  const setFilters = fieldSetter(setView, 'filters')
  const setGroup = fieldSetter(setView, 'group')
  const setSorting = fieldSetter(setView, 'sorting')
  const setExpanded = fieldSetter(setView, 'expanded')
  const [exportOpen, setExportOpen] = useState(false)

  useEffect(() => {
    window.api.sales.rows().then(setRows)
  }, [])

  const products = useMemo(() => uniqueBy(rows, (r) => ({ id: r.productId, name: r.productName })), [rows])
  const buyers = useMemo(() => uniqueBy(rows.filter((r) => r.buyerId != null), (r) => ({ id: r.buyerId!, name: r.buyerName! })), [rows])
  const filtered = useMemo(() => filterRows(rows, filters), [rows, filters])
  const grouping = useMemo<GroupingState>(() => (group === 'none' ? [] : [group]), [group])

  const table = useReactTable({
    data: filtered,
    columns,
    state: { sorting, grouping, expanded },
    onSortingChange: setSorting,
    onExpandedChange: setExpanded,
    getCoreRowModel: getCoreRowModel(),
    getGroupedRowModel: getGroupedRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getExpandedRowModel: getExpandedRowModel(),
    autoResetExpanded: false
  })
  // same rows and sort without grouping: what "Com filtros atuais" exports
  const flatTable = useReactTable({ data: filtered, columns, state: { sorting }, getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel() })

  const set = (patch: Partial<SalesFilters>): void => setFilters((f) => ({ ...f, ...patch }))
  const hasFilters = JSON.stringify(filters) !== JSON.stringify(emptyFilters)
  const totals = filtered.reduce((t, r) => ({ qty: t.qty + r.quantity, sum: t.sum + r.subtotalCents }), { qty: 0, sum: 0 })

  const exportRows = async (which: 'all' | 'filtered'): Promise<void> => {
    setExportOpen(false)
    const data = which === 'all' ? rows : flatTable.getRowModel().rows.map((r) => r.original)
    try {
      if (await window.api.sales.exportXlsx(data)) toast.success('Planilha exportada', { description: plural(data.length) })
    } catch (e) {
      toast.error('Não foi possível exportar', { description: (e as Error).message })
    }
  }

  const headers = table.getHeaderGroups()[0].headers
  const tableRows = table.getRowModel().rows

  return (
    <div className="mx-auto flex max-w-6xl flex-col">
      <PageHeader
        title="Vendas"
        description={`${plural(rows.length)} vendidos no total`}
        actions={
          <Dropdown isOpen={exportOpen} onOpenChange={setExportOpen}>
            <DropdownTrigger className={cx(buttonStyles.base, buttonStyles.size.medium, buttonStyles.variant.secondary)}>
              <RiFileExcel2Line className={buttonStyles.icon.medium} aria-hidden />
              <span className={buttonStyles.label.medium}>Exportar Excel</span>
              <RiArrowDownSLine className={buttonStyles.icon.medium} aria-hidden />
            </DropdownTrigger>
            <DropdownPopover aria-label="Exportar" className="w-64 p-2">
              <DropdownItem onSelect={() => exportRows('filtered')} className="px-2 py-1.5">
                <span className="flex flex-col">
                  <span className="text-body-medium text-text-primary">Com filtros atuais</span>
                  <span className="text-caption-1-regular text-text-tertiary">{plural(filtered.length)}</span>
                </span>
              </DropdownItem>
              <DropdownItem onSelect={() => exportRows('all')} className="px-2 py-1.5">
                <span className="flex flex-col">
                  <span className="text-body-medium text-text-primary">Tudo</span>
                  <span className="text-caption-1-regular text-text-tertiary">{plural(rows.length)}</span>
                </span>
              </DropdownItem>
            </DropdownPopover>
          </Dropdown>
        }
      />
      <Card className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Input aria-label="Buscar" placeholder="Buscar comprador ou produto…" leadingIcon={RiSearchLine} size="small" value={filters.search} onChange={(search) => set({ search })} className="flex-1" />
          <Select aria-label="Agrupar por" size="sm" selectedKey={group} onSelectionChange={(k) => setGroup(k as GroupKey)} renderValue={({ selectedText }) => `Agrupar: ${selectedText}`}>
            {(Object.keys(GROUP_LABEL) as GroupKey[]).map((k) => (
              <SelectItem key={k} id={k} textValue={GROUP_LABEL[k]}>
                {GROUP_LABEL[k]}
              </SelectItem>
            ))}
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <DateRangePicker
            aria-label="Período"
            placeholder="Período"
            value={filters.from && filters.to ? { start: isoToCalendar(filters.from)!, end: isoToCalendar(filters.to)! } : null}
            onChange={(v) => set({ from: calendarToIso(v?.start ?? null), to: calendarToIso(v?.end ?? null) })}
          />
          <Select aria-label="Enviado" size="sm" selectedKey={filters.shipped} onSelectionChange={(k) => set({ shipped: k as SalesFilters['shipped'] })} renderValue={({ selectedText }) => `Enviado: ${selectedText}`}>
            <SelectItem id="all" textValue="Todos">Todos</SelectItem>
            <SelectItem id="yes" textValue="Sim">Sim</SelectItem>
            <SelectItem id="no" textValue="Não">Não</SelectItem>
          </Select>
          <IdFilter label="Filtrar produto" options={products} selected={filters.productIds} onChange={(productIds) => set({ productIds })} />
          <IdFilter label="Filtrar comprador" options={buyers} selected={filters.buyerIds} onChange={(buyerIds) => set({ buyerIds })} />
        </div>

        {hasFilters && (
          <div className="flex flex-wrap items-center gap-1.5">
            {filters.productIds.map((id) => (
              <FilterChip key={`p${id}`} label={products.find((p) => p.id === id)?.name ?? ''} onRemove={() => set({ productIds: filters.productIds.filter((x) => x !== id) })} />
            ))}
            {filters.buyerIds.map((id) => (
              <FilterChip key={`b${id}`} label={buyers.find((b) => b.id === id)?.name ?? ''} onRemove={() => set({ buyerIds: filters.buyerIds.filter((x) => x !== id) })} />
            ))}
            <Button variant="ghost" size="xs" onClick={() => setFilters(emptyFilters)}>
              Limpar filtros
            </Button>
          </div>
        )}

        <Table
          aria-label="Vendas"
          selectionMode="none"
          onRowAction={(key) => {
            const leaf = tableRows.find((r) => r.id === key)
            if (leaf && !leaf.getIsGrouped()) navigate({ name: 'edit-sale', saleId: leaf.original.saleId })
            else leaf?.toggleExpanded()
          }}
        >
          <TableHeader>
            {headers.map((h) => {
              const sorted = h.column.getIsSorted()
              return (
                <TableColumn key={h.id} id={h.id} isRowHeader={h.id === 'date'}>
                  {h.column.getCanSort() ? (
                    <button type="button" onClick={h.column.getToggleSortingHandler()} className="flex cursor-pointer items-center gap-0.5">
                      {String(h.column.columnDef.header)}
                      {sorted === 'asc' ? <RiArrowUpSLine className="size-4" aria-hidden /> : sorted === 'desc' ? <RiArrowDownSLine className="size-4" aria-hidden /> : null}
                    </button>
                  ) : (
                    <span className={cx('block', NUMERIC.has(h.id) && 'text-right')}>{String(h.column.columnDef.header)}</span>
                  )}
                </TableColumn>
              )
            })}
          </TableHeader>
          <TableBody
            items={tableRows}
            dependencies={[expanded, group]}
            renderEmptyState={() => (
              <div className="flex h-48 flex-col items-center justify-center gap-3">
                <span className="text-body-medium text-text-tertiary">Nenhuma venda encontrada</span>
                <Button size="small" leadingIcon={RiAddLine} onClick={() => navigate({ name: 'new-sale' })}>
                  Nova venda
                </Button>
              </div>
            )}
          >
            {(row) =>
              row.getIsGrouped() ? (
                <TableRow id={row.id} className="cursor-pointer bg-background-secondary-default">
                  {row.getVisibleCells().map((cell, i) => (
                    <TableCell key={cell.id} className={NUMERIC.has(cell.column.id) ? 'text-right tabular-nums' : undefined}>
                      {i === 0 ? (
                        <span className="flex items-center gap-1.5 text-body-semibold text-text-primary">
                          {row.getIsExpanded() ? <RiArrowDownSLine className="size-4" aria-hidden /> : <RiArrowRightSLine className="size-4" aria-hidden />}
                          {group === 'date' ? formatDateBR(String(row.groupingValue)) : row.groupingValue === '—' ? 'Sem comprador' : String(row.groupingValue)}
                          <span className="text-caption-1-regular text-text-tertiary">({plural(row.subRows.length)})</span>
                        </span>
                      ) : cell.column.id === 'quantity' ? (
                        <span className="text-body-semibold">{Number(cell.getValue())}</span>
                      ) : cell.column.id === 'subtotalCents' ? (
                        <span className="text-body-semibold">{formatBRL(Number(cell.getValue()))}</span>
                      ) : null}
                    </TableCell>
                  ))}
                </TableRow>
              ) : (
                <TableRow id={row.id} className="cursor-pointer">
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id} className={NUMERIC.has(cell.column.id) ? 'text-right tabular-nums' : undefined}>
                      {cell.column.id === 'shipped' ? (
                        <Chip color={row.original.shipped ? 'lime' : 'neutral'} variant="subtle">
                          {row.original.shipped ? 'Sim' : 'Não'}
                        </Chip>
                      ) : (
                        String(cell.column.columnDef.cell && typeof cell.column.columnDef.cell === 'function' ? cell.column.columnDef.cell(cell.getContext()) : cell.getValue())
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              )
            }
          </TableBody>
        </Table>

        <div className="flex items-center justify-end gap-6 border-t border-separator-border px-2 pt-3 text-body-medium text-text-secondary">
          <span>{plural(filtered.length)}</span>
          <span>
            Qtd <span className="tabular-nums text-text-primary">{totals.qty}</span>
          </span>
          <span>
            Total <span className="text-body-semibold tabular-nums text-text-primary">{formatBRL(totals.sum)}</span>
          </span>
        </div>
      </Card>
    </div>
  )
}

function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }): React.JSX.Element {
  return (
    <Chip color="neutral" variant="subtle" className="gap-1">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remover filtro ${label}`} className="cursor-pointer rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-border-focus-ring">
        <RiCloseLine className="size-3.5" aria-hidden />
      </button>
    </Chip>
  )
}

function uniqueBy<T extends { id: number; name: string }>(rows: SaleRow[], pick: (r: SaleRow) => T): T[] {
  const map = new Map<number, T>()
  for (const r of rows) {
    const v = pick(r)
    map.set(v.id, v)
  }
  return [...map.values()].sort((a, b) => nameKey(a.name).localeCompare(nameKey(b.name)))
}
