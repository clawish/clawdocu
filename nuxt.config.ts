// https://nuxt.com/docs/4.x/getting-started/configuration
import { readFileSync } from 'fs'
const pkg = JSON.parse(readFileSync('./package.json', 'utf-8'))

export default defineNuxtConfig({
  compatibilityDate: '2026-04-26',
  devtools: { enabled: true },
  
  modules: ['@nuxt/ui', '@vueuse/nuxt', '@nuxtjs/i18n'],

  // i18n — same stack as nuxt-admin/justmathit (fleet convention).
  // 'except_default': English at /, Chinese under /zh. No browser redirect:
  // this is a self-hosted tool where users pick their language once via the
  // header switcher (a surprise redirect on / would break deep links to
  // projects/files that people share).
  i18n: {
    defaultLocale: 'en',
    strategy: 'prefix_except_default',
    locales: [
      { code: 'en', name: 'English', file: 'en.json' },
      { code: 'zh', name: '简体中文', file: 'zh.json' }
    ],
    detectBrowserLanguage: {
      useCookie: true,
      cookieKey: 'clawdocu_i18n',
      // Same as MFT/posterlet: browser detection only ever redirects the root
      // (first visit), never deep links. Persistence within the app comes
      // from localePath()-wrapped links — URLs carry the locale.
      redirectOn: 'root',
      alwaysRedirect: false,
      fallbackLocale: 'en'
    }
  },
  
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
