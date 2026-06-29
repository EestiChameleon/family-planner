import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'

// Инициализация Telegram Mini App: сообщаем клиенту, что приложение готово,
// и разворачиваем на всю высоту. Если открыто вне Telegram — Telegram отсутствует,
// поэтому используем optional chaining и страница всё равно работает.
const tg = window.Telegram?.WebApp
tg?.ready()
tg?.expand()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
