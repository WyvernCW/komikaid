import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'id.komikaid.app',
  appName: 'KomikaID',
  webDir: 'dist',
  loggingBehavior: 'none',
  server: {
    androidScheme: 'https',
    hostname: 'app.komikaid.pages.dev',
  },
}

export default config
