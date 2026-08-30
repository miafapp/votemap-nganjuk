import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import DetailPage from './components/DetailPage.jsx'

const isDetailPath = window.location.pathname.startsWith('/wilayah/')

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isDetailPath ? <DetailPage /> : <App />}
  </StrictMode>,
)
