import { createApp } from './app.js'

const port = Number(process.env.PORT ?? 8787)
const server = createApp().listen(port, '0.0.0.0', () => {
  console.log(JSON.stringify({ level: 'info', message: 'KomikaID API listening', port }))
})

const shutdown = () => server.close(() => process.exit(0))
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
