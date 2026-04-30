// https://nuxt.com/docs/4.x/getting-started/configuration
export default defineNuxtConfig({
  compatibilityDate: '2026-04-26',
  devtools: { enabled: true },
  
  modules: ['@nuxt/ui', '@vueuse/nuxt'],
  
  ui: {
    colorMode: false
  },
  
  css: ['~/assets/css/main.css'],
  
  runtimeConfig: {
    adminPassword: process.env.ADMIN_PASSWORD,
    githubToken: process.env.GITHUB_TOKEN,
    databasePath: process.env.DATABASE_PATH,
  },


})
