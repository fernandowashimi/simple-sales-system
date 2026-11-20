import { RiUserAddLine, RiUserLine } from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { Modal, ModalBody, ModalFooter, ModalHeader } from '@/components/base/modal/modal'
import type { Buyer } from '../../../shared/types'

export function SimilarBuyerModal({
  newName,
  matches,
  onUseExisting,
  onCreateNew,
  onCancel
}: {
  newName: string | null
  matches: Buyer[]
  onUseExisting: (b: Buyer) => void
  onCreateNew: () => void
  onCancel: () => void
}): React.JSX.Element {
  return (
    <Modal isOpen={newName != null} onOpenChange={(open) => !open && onCancel()} size="sm">
      <ModalHeader title="Comprador parecido" description={`Já existe um comprador com nome parecido com "${newName ?? ''}".`} />
      <ModalBody>
        <div className="flex flex-col gap-2">
          {matches.map((b, i) => (
            <Button key={b.id} variant={i === 0 ? 'primary' : 'secondary'} leadingIcon={RiUserLine} autoFocus={i === 0} onClick={() => onUseExisting(b)} className="justify-start">
              Usar {b.name}
            </Button>
          ))}
        </div>
      </ModalBody>
      <ModalFooter>
        <Button variant="ghost" onClick={onCancel}>
          Voltar
        </Button>
        <Button variant="secondary" leadingIcon={RiUserAddLine} onClick={onCreateNew}>
          Cadastrar &ldquo;{newName}&rdquo;
        </Button>
      </ModalFooter>
    </Modal>
  )
}
