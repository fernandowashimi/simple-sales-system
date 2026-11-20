import { useMemo } from 'react'
import { RiUserAddLine, RiUserLine } from '@remixicon/react'
import { ComboBox, ComboBoxItem } from '@/components/base/combobox/combobox'
import type { Buyer } from '../../../shared/types'
import { nameKey } from '../../../shared/names'

const NEW_KEY = '__new__'
type Option = { id: number | typeof NEW_KEY; name: string }

export function BuyerField({
  buyers,
  text,
  buyerId,
  onChange
}: {
  buyers: Buyer[]
  text: string
  buyerId: number | null
  onChange: (text: string, buyerId: number | null) => void
}): React.JSX.Element {
  const options = useMemo<Option[]>(() => {
    const q = nameKey(text)
    const matches: Option[] = q ? buyers.filter((b) => nameKey(b.name).includes(q)) : buyers
    const exact = buyers.some((b) => nameKey(b.name) === q)
    return q && !exact ? [...matches, { id: NEW_KEY, name: text.trim() }] : matches
  }, [buyers, text])

  return (
    <ComboBox<Option>
      label="Comprador"
      placeholder="Opcional — digite para buscar"
      leadingIcon={RiUserLine}
      allowsCustomValue
      menuTrigger="focus"
      items={options}
      inputValue={text}
      selectedKey={buyerId}
      emptyMessage="Nenhum comprador cadastrado ainda"
      onInputChange={(value) => {
        // match by key, not by the buyerId prop: React Aria fires this right after a selection, before the new id arrives
        const match = buyers.find((b) => nameKey(b.name) === nameKey(value))
        onChange(value, match ? match.id : null)
      }}
      onSelectionChange={(key) => {
        if (key == null || key === NEW_KEY) return
        const b = buyers.find((x) => x.id === key)
        if (b) onChange(b.name, b.id)
      }}
      className="w-full"
    >
      {(o) => (
        <ComboBoxItem id={o.id} textValue={o.name}>
          {o.id === NEW_KEY ? (
            <span className="flex items-center gap-2 text-text-secondary">
              <RiUserAddLine className="size-4 text-foreground-icon-tertiary" aria-hidden />
              Cadastrar &ldquo;{o.name}&rdquo; ao salvar
            </span>
          ) : (
            <span className="truncate">{o.name}</span>
          )}
        </ComboBoxItem>
      )}
    </ComboBox>
  )
}
