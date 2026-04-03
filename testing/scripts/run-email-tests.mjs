import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const playwrightCli = require.resolve('@playwright/test/cli');

const run = spawnSync(process.execPath, [
  playwrightCli,
  'test',
  'e2e/emails',
  '--grep',
  '@email',
  '--project=chromium',
], {
  stdio: 'inherit',
  env: {
    ...process.env,
    // Email suite is explicit opt-in and may use real SMTP settings.
    ENABLE_REAL_EMAIL_TESTS: '1',
    SMTP_SERVER: process.env.SMTP_SERVER || 'smtp.gmail.com',
  },
});

process.exit(Number.isInteger(run.status) ? run.status : 1);
