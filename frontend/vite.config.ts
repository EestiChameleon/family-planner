import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Mini App отдаётся с корня домена (fp.antifreeze.dev), поэтому base = '/'.
export default defineConfig({
  plugins: [react()],
})
