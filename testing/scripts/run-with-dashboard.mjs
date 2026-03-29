import { spawnSync } from 'node:child_process';

const isWindows = process.platform === 'win32';

const testRun = spawnSync('npm', ['exec', 'playwright', 'test', '--grep-invert', '@email'], {
  stdio: 'inherit',
  shell: isWindows,
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
