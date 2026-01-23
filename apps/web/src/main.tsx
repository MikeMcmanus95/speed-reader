import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setBaseUrl } from '@speed-reader/api-client'
import './index.css'
import App from './App.tsx'

// Configure API base URL from environment variable
// In development, this is empty (uses Vite proxy)
// In production, this points to the API domain
setBaseUrl(import.meta.env.VITE_API_URL || '')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
