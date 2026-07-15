"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const cliPath = path.resolve(__dirname, "..", "bin", "db-cli.js");

function run(args) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    env: { ...process.env, DB_CLI_SKIP_UTF8_CONSOLE: "1" }
  });
}

test("streams SQLite query rows with the existing output contract", () => {
  const result = run([
    "-g", "sq", "-d", ":memory:", "-e",
    "WITH RECURSIVE n(x) AS (SELECT 1 UNION ALL SELECT x+1 FROM n WHERE x < 3) SELECT x FROM n"
  ]);

  assert.equal(result.status, 0);
  assert.equal(result.stdout, "x\n1\n2\n3\n");
  assert.equal(result.stderr, "");
});

test("renders each statement as soon as it completes", () => {
  const result = run([
    "-g", "sq", "-d", ":memory:", "-e",
    "CREATE TABLE t(id INTEGER); INSERT INTO t VALUES (1); SELECT id FROM t;"
  ]);

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^command\|1\nstatus\|affectedRows\|insertId\nok\|0\|0\n/);
  assert.match(result.stdout, /command\|3\nid\n1\n$/);
});

test("writes UTF-8 output through one managed file handle", () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "db-cli-test-"));
  const outputPath = path.join(directory, "result.txt");

  try {
    const result = run([
      "-g", "sq", "-d", ":memory:", "-e", "SELECT 'ภาษาไทย' AS value", "-o", outputPath
    ]);

    assert.equal(result.status, 0);
    assert.equal(result.stdout, "");
    assert.equal(fs.readFileSync(outputPath, "utf8"), "value\nภาษาไทย\n");
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
});
