import fs from 'node:fs';
import path from 'node:path';

const testingRoot = process.cwd();
const resultsPath = path.join(testingRoot, 'test-results', 'results.json');
const dashboardDir = path.join(testingRoot, 'playwright-report');
const dashboardPath = path.join(dashboardDir, 'dashboard.html');

function safeReadJson(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing Playwright JSON report: ${filePath}`);
  }
  const raw = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(raw);
}

function parseLeafTests(node, acc) {
  if (!node || typeof node !== 'object') {
    return;
  }

  if (Array.isArray(node.specs)) {
    for (const spec of node.specs) {
      const specTitle = spec.title || 'Untitled spec';
      const tests = Array.isArray(spec.tests) ? spec.tests : [];
      for (const test of tests) {
        const runs = Array.isArray(test.results) ? test.results : [];
        const finalRun = runs[runs.length - 1] || {};
        const status = finalRun.status || test.status || 'unknown';
        const durationMs = Number(finalRun.duration || 0);
        const projectName =
          (test.projectName && String(test.projectName)) ||
          (finalRun.projectName && String(finalRun.projectName)) ||
          'default';
        const errors = Array.isArray(finalRun.errors) ? finalRun.errors : [];
        const errMsg =
          errors.length > 0
            ? errors
                .map((e) => e.message || e.stack || JSON.stringify(e))
                .join('\n\n')
            : '';

        acc.tests.push({
          title: test.title || specTitle,
          specTitle,
          projectName,
          status,
          durationMs,
          error: errMsg,
        });
      }
    }
  }

  if (Array.isArray(node.suites)) {
    for (const suite of node.suites) {
      parseLeafTests(suite, acc);
    }
  }
}

function summarize(reportJson) {
  const acc = { tests: [] };
  const suites = Array.isArray(reportJson.suites) ? reportJson.suites : [];
  for (const suite of suites) {
    parseLeafTests(suite, acc);
  }

  const totals = {
    total: 0,
    passed: 0,
    failed: 0,
    skipped: 0,
    timedOut: 0,
    interrupted: 0,
    flaky: 0,
    unknown: 0,
    durationMs: 0,
  };

  const perProject = {};

  for (const t of acc.tests) {
    totals.total += 1;
    totals.durationMs += t.durationMs;

    if (t.status === 'passed') totals.passed += 1;
    else if (t.status === 'failed') totals.failed += 1;
    else if (t.status === 'skipped') totals.skipped += 1;
    else if (t.status === 'timedOut') totals.timedOut += 1;
    else if (t.status === 'interrupted') totals.interrupted += 1;
    else if (t.status === 'flaky') totals.flaky += 1;
    else totals.unknown += 1;

    if (!perProject[t.projectName]) {
      perProject[t.projectName] = {
        total: 0,
        passed: 0,
        failed: 0,
        durationMs: 0,
      };
    }
    perProject[t.projectName].total += 1;
    perProject[t.projectName].durationMs += t.durationMs;
    if (t.status === 'passed') perProject[t.projectName].passed += 1;
    if (t.status === 'failed') perProject[t.projectName].failed += 1;
  }

  const passRate = totals.total > 0 ? (totals.passed / totals.total) * 100 : 0;

  const failures = acc.tests
    .filter((t) => t.status === 'failed')
    .map((t) => ({
      title: t.title,
      projectName: t.projectName,
      error: t.error || 'No failure details available in JSON report.',
    }));

  return {
    generatedAt: new Date().toISOString(),
    totals,
    passRate,
    perProject,
    failures,
    tests: acc.tests,
  };
}

function fmtDuration(ms) {
  if (!Number.isFinite(ms)) return '0 ms';
  if (ms < 1000) return `${ms.toFixed(0)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

function buildDashboardHtml(summary) {
  const perProjectRows = Object.entries(summary.perProject)
    .map(([name, v]) => {
      const rate = v.total ? ((v.passed / v.total) * 100).toFixed(1) : '0.0';
      return `<tr>
        <td>${name}</td>
        <td>${v.total}</td>
        <td>${v.passed}</td>
        <td>${v.failed}</td>
        <td>${rate}%</td>
        <td>${fmtDuration(v.durationMs)}</td>
      </tr>`;
    })
    .join('');

  const failureRows = summary.failures
    .map(
      (f) => `<tr>
        <td>${f.projectName}</td>
        <td>${f.title}</td>
        <td><pre>${escapeHtml(f.error)}</pre></td>
      </tr>`
    )
    .join('');

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>SBLR1071 Test Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
  <style>
    :root {
      --bg: #0f172a;
      --panel: #111827;
      --card: #1f2937;
      --text: #e5e7eb;
      --muted: #9ca3af;
      --pass: #22c55e;
      --fail: #ef4444;
      --skip: #f59e0b;
      --accent: #38bdf8;
      --border: #334155;
    }
    body {
      margin: 0;
      font-family: Segoe UI, Tahoma, sans-serif;
      background: radial-gradient(circle at top right, #1e293b, var(--bg));
      color: var(--text);
      padding: 24px;
    }
    h1, h2 { margin: 0 0 12px; }
    .sub { color: var(--muted); margin-bottom: 20px; }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 20px;
    }
    .card {
      background: linear-gradient(180deg, #1f2937, #111827);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 14px;
    }
    .label { color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.08em; }
    .value { font-size: 28px; font-weight: 700; margin-top: 6px; }
    .row {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
      margin-bottom: 20px;
    }
    .panel {
      background: var(--panel);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      overflow: auto;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    th, td {
      border-bottom: 1px solid var(--border);
      text-align: left;
      vertical-align: top;
      padding: 8px;
    }
    th { color: var(--muted); font-weight: 600; }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      font-size: 12px;
      color: #fca5a5;
    }
    .footer { margin-top: 12px; color: var(--muted); font-size: 12px; }
    @media (max-width: 900px) {
      .row { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <h1>SBLR1071 Test Execution Dashboard</h1>
  <div class="sub">Generated: ${summary.generatedAt}</div>

  <section class="grid">
    <div class="card"><div class="label">Total</div><div class="value">${summary.totals.total}</div></div>
    <div class="card"><div class="label">Passed</div><div class="value" style="color: var(--pass)">${summary.totals.passed}</div></div>
    <div class="card"><div class="label">Failed</div><div class="value" style="color: var(--fail)">${summary.totals.failed}</div></div>
    <div class="card"><div class="label">Pass Rate</div><div class="value" style="color: var(--accent)">${summary.passRate.toFixed(1)}%</div></div>
    <div class="card"><div class="label">Skipped</div><div class="value" style="color: var(--skip)">${summary.totals.skipped}</div></div>
    <div class="card"><div class="label">Duration</div><div class="value">${fmtDuration(summary.totals.durationMs)}</div></div>
  </section>

  <section class="row">
    <div class="panel">
      <h2>Status Breakdown</h2>
      <canvas id="statusChart" height="160"></canvas>
    </div>
    <div class="panel">
      <h2>Project Pass Rates</h2>
      <canvas id="projectChart" height="160"></canvas>
    </div>
  </section>

  <section class="panel" style="margin-bottom: 20px;">
    <h2>Per-Project Metrics</h2>
    <table>
      <thead>
        <tr>
          <th>Project</th>
          <th>Total</th>
          <th>Passed</th>
          <th>Failed</th>
          <th>Pass Rate</th>
          <th>Duration</th>
        </tr>
      </thead>
      <tbody>
        ${perProjectRows || '<tr><td colspan="6">No project metrics available.</td></tr>'}
      </tbody>
    </table>
  </section>

  <section class="panel">
    <h2>Failure Details</h2>
    <table>
      <thead>
        <tr>
          <th>Project</th>
          <th>Test</th>
          <th>Error</th>
        </tr>
      </thead>
      <tbody>
        ${failureRows || '<tr><td colspan="3">No failures in this run.</td></tr>'}
      </tbody>
    </table>
  </section>

  <div class="footer">Playwright HTML report remains available in the same folder.</div>

  <script>
    const summary = ${JSON.stringify(summary)};

    const statusCtx = document.getElementById('statusChart');
    new Chart(statusCtx, {
      type: 'doughnut',
      data: {
        labels: ['Passed', 'Failed', 'Skipped', 'TimedOut', 'Flaky', 'Other'],
        datasets: [{
          data: [
            summary.totals.passed,
            summary.totals.failed,
            summary.totals.skipped,
            summary.totals.timedOut,
            summary.totals.flaky,
            summary.totals.unknown + summary.totals.interrupted
          ],
          backgroundColor: ['#22c55e', '#ef4444', '#f59e0b', '#f97316', '#60a5fa', '#94a3b8']
        }]
      },
      options: {
        plugins: {
          legend: { labels: { color: '#e5e7eb' } }
        }
      }
    });

    const projects = Object.entries(summary.perProject);
    const projectCtx = document.getElementById('projectChart');
    new Chart(projectCtx, {
      type: 'bar',
      data: {
        labels: projects.map(([name]) => name),
        datasets: [{
          label: 'Pass Rate %',
          data: projects.map(([, p]) => (p.total ? (p.passed / p.total) * 100 : 0)),
          backgroundColor: '#38bdf8'
        }]
      },
      options: {
        scales: {
          y: {
            min: 0,
            max: 100,
            ticks: { color: '#cbd5e1' },
            grid: { color: '#334155' }
          },
          x: {
            ticks: { color: '#cbd5e1' },
            grid: { color: '#334155' }
          }
        },
        plugins: {
          legend: { labels: { color: '#e5e7eb' } }
        }
      }
    });
  </script>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function main() {
  try {
    const reportJson = safeReadJson(resultsPath);
    const summary = summarize(reportJson);

    fs.mkdirSync(dashboardDir, { recursive: true });
    fs.writeFileSync(dashboardPath, buildDashboardHtml(summary), 'utf8');

    console.log(`Dashboard report generated: ${dashboardPath}`);
  } catch (err) {
    console.error('Could not generate dashboard report.');
    console.error(err.message || err);
    process.exitCode = 1;
  }
}

main();
