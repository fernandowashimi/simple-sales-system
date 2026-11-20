
import { useEffect, useState } from 'react'
import { RiAddCircleLine, RiDatabase2Line, RiPlantLine, RiTableLine, type RemixiconComponentType } from '@remixicon/react'
import { Button } from '@/components/base/buttons/button'
import { toast } from '@/components/base/toast/toast'
import { cx } from '@/utils/cx'
import type { Page } from '../App'

type Icon = RemixiconComponentType

const NAV: { name: Page['name']; label: string; icon: Icon }[] = [
  { name: 'sales', label: 'Vendas', icon: RiTableLine },
  { name: 'new-sale', label: 'Nova venda', icon: RiAddCircleLine },
  { name: 'products', label: 'Produtos', icon: RiPlantLine }
]

// Nav row styles adapted from BoardUI's DashboardSidebar NavItem.
function NavItem({ label, icon: Icon, isSelected, onPress }: { label: string; icon: Icon; isSelected: boolean; onPress: () => void }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onPress}
      aria-current={isSelected ? 'page' : undefined}
      className={cx(
        'flex w-full cursor-pointer items-center gap-2 rounded-2lg p-2 outline-none transition-colors duration-150',
        'focus-visible:ring-2 focus-visible:ring-border-focus-ring',
        isSelected ? 'bg-linear-to-b from-accent-500 to-accent-600 shadow-nav-selected' : 'hover:bg-background-secondary-hover'
      )}
    >
      <Icon className={cx('size-5 shrink-0', isSelected ? 'text-white' : 'text-foreground-icon-secondary')} aria-hidden />
      <span className={cx('text-body-medium whitespace-nowrap', isSelected ? 'text-white' : 'text-text-secondary')}>{label}</span>
    </button>
  )
}

export function AppSidebar({ page, navigate }: { page: Page; navigate: (p: Page) => void }): React.JSX.Element {
  const [dbPath, setDbPath] = useState('')
  useEffect(() => {
    window.api.db.path().then(setDbPath)
  }, [])

  const backup = async (): Promise<void> => {
    try {
      if (await window.api.db.backup()) toast.success('Backup salvo')
    } catch (e) {
      toast.error('Não foi possível salvar o backup', { description: (e as Error).message })
    }
  }

  const current = page.name === 'edit-sale' ? 'sales' : page.name

  return (
    <aside className="flex h-full w-[240px] shrink-0 flex-col justify-between rounded-3xl border border-border-button-white bg-background-secondary-default p-3 shadow-sidebar">
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-2 px-2 pt-1">
          <span className="flex size-8 items-center justify-center rounded-xl bg-linear-to-b from-accent-500 to-accent-600">
            <RiPlantLine className="size-4.5 text-white" aria-hidden />
          </span>
          <div className="flex flex-col">
            <span className="text-body-semibold text-text-primary">Fructus Viveiro</span>
            <span className="text-caption-1-regular text-text-tertiary">Gestão de vendas</span>
          </div>
        </div>
        <nav className="flex flex-col gap-1" aria-label="Navegação">
          {NAV.map((n) => (
            <NavItem key={n.name} label={n.label} icon={n.icon} isSelected={current === n.name} onPress={() => navigate({ name: n.name } as Page)} />
          ))}
        </nav>
      </div>
      <div className="flex flex-col gap-2">
        <Button variant="secondary" size="small" leadingIcon={RiDatabase2Line} onClick={backup}>
          Fazer backup
        </Button>
        <p className="truncate px-1 text-caption-1-regular text-text-tertiary" dir="ltr" title={dbPath}>
          {dbPath}
        </p>
      </div>
    </aside>
  )
}
