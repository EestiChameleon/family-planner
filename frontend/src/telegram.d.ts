export {}

// Минимальный тип Telegram WebApp SDK — расширим по мере использования методов.
declare global {
  interface TelegramWebApp {
    ready: () => void
    expand: () => void
    [key: string]: unknown
  }

  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}
