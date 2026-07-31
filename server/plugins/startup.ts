export default defineNitroPlugin(() => {
  const config = useRuntimeConfig()
  console.log(`🚀 ClawDocu server started — v${config.version}`)
})
