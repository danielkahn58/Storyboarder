const { defineConfig } = require('vitest/config');

module.exports = defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.js'],
    // Always emit a machine-readable summary alongside the normal terminal output —
    // the server reads this file for the in-app "Tests" panel (see /api/test-results).
    reporters: ['default', ['json', { outputFile: 'test-results.json' }]],
  },
});
