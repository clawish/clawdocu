// https://nuxt.com/docs/4.x/getting-started/configuration
import { readFileSync } from 'fs'
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineNuxtConfig({
  compatibilityDate: '2026-04-26',
  devtools: { enabled: true },
  
  modules: ['@nuxt/ui', '@vueuse/nuxt'],
  
  ui: {
    colorMode: false
  },
  
  css: ['~/assets/css/main.css'],
  
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' }
      ]
    }
  },
  
  runtimeConfig: {
    adminPassword: process.env.ADMIN_PASSWORD,
    githubToken: process.env.GITHUB_TOKEN,
    databasePath: process.env.DATABASE_PATH,
    version: pkg.version,
    public: {
      version: pkg.version,
    },
  },
})
