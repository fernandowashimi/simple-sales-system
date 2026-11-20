import type { ReactNode } from 'react'
import { cx } from '@/utils/cx'

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }): React.JSX.Element {
  return (
    <header className="flex items-end justify-between gap-4 px-1 pb-5 pt-3">
      <div className="flex flex-col gap-1">
        <h1 className="text-title-2-semibold text-text-primary">{title}</h1>
        {description && <p className="text-body-regular text-text-secondary">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  )
}

export function Card({ children, className }: { children: ReactNode; className?: string }): React.JSX.Element {
  return (
    <section className={cx("rounded-3xl border border-border-button-default bg-background-primary-default p-5", className)}>{children}</section>
  )
}
