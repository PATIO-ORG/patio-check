import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import { App } from './App'
import { DataProvider } from './data/provider'
import { SessaoProvider } from './auth/sessao'
import { SeletorPaleta } from './features/shared/SeletorPaleta'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <DataProvider>
      <SessaoProvider>
        <BrowserRouter basename={import.meta.env.BASE_URL}>
          <App />
        </BrowserRouter>
        <SeletorPaleta />
      </SessaoProvider>
    </DataProvider>
  </StrictMode>,
)
