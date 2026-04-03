import { spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';

const testRun = spawnSync('npx', ['playwright', 'test', '--grep-invert', '@email'], {
  stdio: 'inherit',
  shell: isWindows,
  env: {
    ...process.env,
    ENABLE_REAL_EMAIL_TESTS: '0',
    SMTP_SERVER: 'smtp.example.com',
  },
});

const testExitCode = Number.isInteger(testRun.status) ? testRun.status : 1;

const dashboardRun = spawnSync('node', ['scripts/generate-dashboard.mjs'], {
  stdio: 'inherit',
  shell: isWindows,
});

if (dashboardRun.status !== 0) {
  console.error('Dashboard generation failed.');
}

process.exit(testExitCode);
