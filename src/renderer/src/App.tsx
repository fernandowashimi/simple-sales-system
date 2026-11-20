import { useState } from 'react'
import { Toaster } from '@/components/base/toast/toast'
import { AppSidebar } from './components/AppSidebar'
import { ProductsPage } from './pages/ProductsPage'
import { SaleFormPage } from './pages/SaleFormPage'
import { SalesPage } from './pages/SalesPage'

export type Page = { name: 'sales' } | { name: 'new-sale' } | { name: 'edit-sale'; saleId: number } | { name: 'products' }

export default function App(): React.JSX.Element {
  const [page, setPage] = useState<Page>({ name: 'new-sale' })

  return (
    <div className="flex h-screen gap-3 bg-background-full p-3">
      <AppSidebar page={page} navigate={setPage} />
      <main className="min-w-0 flex-1 overflow-y-auto">
        {page.name === 'sales' && <SalesPage navigate={setPage} />}
        {page.name === 'new-sale' && <SaleFormPage key="new" navigate={setPage} />}
        {page.name === 'edit-sale' && <SaleFormPage key={page.saleId} saleId={page.saleId} navigate={setPage} />}
        {page.name === 'products' && <ProductsPage />}
      </main>
      <Toaster />
    </div>
  )
}
