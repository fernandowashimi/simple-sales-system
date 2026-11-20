import '@fontsource-variable/inter'
import '@/styles/globals.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { I18nProvider } from 'react-aria-components'
import { TemplateCopyProvider } from '@/components/foundations/template-copy/template-copy'
import { translate } from './lib/i18n'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <I18nProvider locale="pt-BR">
      <TemplateCopyProvider translate={translate}>
        <App />
      </TemplateCopyProvider>
    </I18nProvider>
  </StrictMode>
)
