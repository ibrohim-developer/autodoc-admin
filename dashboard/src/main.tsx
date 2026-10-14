import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { AppProviders } from '@/app/providers'
import { router } from '@/app/router'
import { watchSystemTheme } from '@/stores/theme-store'
import '@/styles/index.css'

const rootElement = document.getElementById('root')
if (!rootElement) throw new Error('Missing #root element in index.html')

watchSystemTheme()

createRoot(rootElement).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
