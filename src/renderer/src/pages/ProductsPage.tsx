import { useEffect, useMemo, useRef, useState } from 'react'
import { RiAddLine, RiCheckLine, RiCloseLine, RiDeleteBinLine, RiPencilLine, RiSearchLine } from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { Input } from '@/components/base/input/input'
import { AlertDialog } from '@/components/base/modal/modal'
import { Table, TableBody, TableCell, TableColumn, TableHeader, TableRow } from '@/components/base/table/table'
import { toast } from '@/components/base/toast/toast'
import type { Product } from '../../../shared/types'
import { nameKey } from '../../../shared/names'
import { Card, PageHeader } from '../components/PageHeader'

type Editing = { id: number | 'new'; value: string } | null

export function ProductsPage(): React.JSX.Element {
  const [products, setProducts] = useState<Product[]>([])
  const [search, setSearch] = useState('')
  const [editing, setEditing] = useState<Editing>(null)
  const [toDelete, setToDelete] = useState<Product | null>(null)
  const editorRef = useRef<HTMLInputElement>(null)
  const editingId = editing?.id
  useEffect(() => {
    if (editingId == null) return
    // React Aria's grid grabs focus on click; take it back on the next frame
    const f = requestAnimationFrame(() => {
      editorRef.current?.focus()
      editorRef.current?.select()
    })
    return () => cancelAnimationFrame(f)
  }, [editingId])

  const reload = (): Promise<void> => window.api.products.list().then(setProducts)
  useEffect(() => {
    reload()
  }, [])

  const visible = useMemo(() => {
    const q = nameKey(search)
    return q ? products.filter((p) => nameKey(p.name).includes(q)) : products
  }, [products, search])

  const save = async (): Promise<void> => {
    if (!editing) return
    try {
      const p = editing.id === 'new' ? await window.api.products.create(editing.value) : await window.api.products.rename(editing.id, editing.value)
      toast.success(editing.id === 'new' ? 'Produto criado' : 'Produto atualizado', { description: p.name })
      setEditing(null)
      await reload()
    } catch (e) {
      toast.error((e as Error).message)
    }
  }

  const remove = async (p: Product): Promise<void> => {
    try {
      await window.api.products.remove(p.id)
      toast.success('Produto excluído', { description: p.name })
      await reload()
    } catch (e) {
      toast.error((e as Error).message)
      throw e
    }
  }

  const editor = (
    <div className="flex items-center gap-2">
      <Input
        aria-label="Nome do produto"
        ref={editorRef}
        className="flex-1"
        size="small"
        value={editing?.value ?? ''}
        onChange={(value) => setEditing((ed) => (ed ? { ...ed, value } : ed))}
        onKeyDown={(e) => {
          // keep React Aria's grid navigation from eating keystrokes
          e.stopPropagation()
          if (e.key === 'Enter' && !e.repeat) save()
          if (e.key === 'Escape') setEditing(null)
        }}
      />
      <Button size="small" iconOnly leadingIcon={RiCheckLine} aria-label="Salvar" onClick={save} />
      <Button size="small" variant="ghost" iconOnly leadingIcon={RiCloseLine} aria-label="Cancelar" onClick={() => setEditing(null)} />
    </div>
  )

  return (
    <div className="mx-auto flex max-w-4xl flex-col">
      <PageHeader
        title="Produtos"
        description={`${products.length} produtos no catálogo`}
        actions={
          <Button leadingIcon={RiAddLine} onClick={() => setEditing({ id: 'new', value: '' })}>
            Novo produto
          </Button>
        }
      />
      <Card className="flex flex-col gap-4">
        <Input aria-label="Buscar produto" placeholder="Buscar produto…" leadingIcon={RiSearchLine} value={search} onChange={setSearch} />
        {editing?.id === 'new' && <div className="rounded-xl bg-background-secondary-default p-2">{editor}</div>}
        <Table aria-label="Produtos" selectionMode="none">
          <TableHeader>
            <TableColumn id="name" isRowHeader>
              Nome
            </TableColumn>
            <TableColumn id="actions" className="w-28">
              <span className="sr-only">Ações</span>
            </TableColumn>
          </TableHeader>
          <TableBody
            items={visible}
            dependencies={[editing]}
            renderEmptyState={() => <div className="flex h-32 items-center justify-center text-body-medium text-text-tertiary">Nenhum produto encontrado.</div>}
          >
            {(p) => (
              <TableRow id={p.id}>
                <TableCell>{editing?.id === p.id ? editor : <span className="text-body-medium text-text-primary">{p.name}</span>}</TableCell>
                <TableCell>
                  {editing?.id !== p.id && (
                    <div className="flex justify-end gap-1">
                      <Button size="small" variant="ghost" iconOnly leadingIcon={RiPencilLine} aria-label={`Editar ${p.name}`} onClick={() => setEditing({ id: p.id, value: p.name })} />
                      <Button size="small" variant="ghost" iconOnly leadingIcon={RiDeleteBinLine} aria-label={`Excluir ${p.name}`} onClick={() => setToDelete(p)} />
                    </div>
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </Card>
      <AlertDialog
        isOpen={toDelete != null}
        onOpenChange={(open) => !open && setToDelete(null)}
        title="Excluir produto?"
        description={toDelete ? `"${toDelete.name}" será removido do catálogo.` : undefined}
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={() => (toDelete ? remove(toDelete) : undefined)}
      />
    </div>
  )
}
