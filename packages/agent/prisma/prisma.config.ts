import { defineConfig } from '@prisma/client'

export default defineConfig({
  adapter: {
    url: process.env.DATABASE_URL || 'postgresql://localhost:5432/kairos'
  }
})
