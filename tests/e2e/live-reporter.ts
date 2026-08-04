import type { Reporter, TestCase, TestResult } from '@playwright/test/reporter';
import * as fs from 'fs';

const LIVE_FILE = '/tmp/pw-e2e-live.jsonl';

export default class LiveReporter implements Reporter {
  onBegin() {
    fs.writeFileSync(LIVE_FILE, '', 'utf8');
  }

  onTestEnd(test: TestCase, result: TestResult) {
    const status = result.status === 'passed' ? 'passed' : 'failed';
    const line = JSON.stringify({ title: test.title, status }) + '\n';
    fs.appendFileSync(LIVE_FILE, line, 'utf8');
  }
}
