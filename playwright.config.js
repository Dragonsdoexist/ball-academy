import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

const liveURL = process.env.BASE_URL;
const baseURL = liveURL || 'http://127.0.0.1:4286/ball-academy/';
const systemChrome = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const executablePath = process.env.CHROMIUM_PATH || (existsSync(systemChrome) ? systemChrome : undefined);
export default defineConfig({
  testDir: './tests/e2e',
  workers: 1,
  timeout: 45000,
  use: {
    baseURL, browserName: 'chromium',
    launchOptions: { executablePath, args: ['--enable-unsafe-swiftshader'] },
    screenshot: 'only-on-failure'
  },
  projects: [
    { name: 'desktop', use: { viewport: { width: 1440, height: 900 } } },
    { name: 'phone', use: { ...devices['iPhone 14'], defaultBrowserType: 'chromium', deviceScaleFactor: 1 } }
  ],
  webServer: liveURL ? undefined : {
    command: 'npm run dev -- --host 127.0.0.1 --port 4286 --strictPort',
    url: baseURL,
    reuseExistingServer: false
  }
});
