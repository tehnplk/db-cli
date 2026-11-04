"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const test = require("node:test");

const cliPath = path.resolve(__dirname, "..", "bin", "db-cli.js");

function run(args, env = {}) {
  return spawnSync(process.execPath, [cliPath, ...args], {
    encoding: "utf8",
    env: { ...process.env, DB_CLI_SKIP_UTF8_CONSOLE: "1", DB_CLI_HASH_SALT: "s3", ...env }
  });
}

// SQLite in-memory fixture: every test that creates tables needs --write.
const sq = (sql, extra = []) => run(["-g", "sq", "-d", ":memory:", "-w", "-e", sql, ...extra]);

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
  const result = sq("CREATE TABLE t(id INTEGER); INSERT INTO t VALUES (1); SELECT id FROM t;");

  assert.equal(result.status, 0);
  assert.match(result.stdout, /^command\|1\nstatus\|affectedRows\|insertId\nok\|0\|0\n/);
  assert.match(result.stdout, /command\|3\nid\n1\n$/);
});

test("read-only by default: refuses writes, CTE writes, SELECT INTO; allows reads and INTO @var", () => {
  for (const sql of [
    "INSERT INTO t VALUES (1)",
    "update t set a = 1",
    "DELETE FROM t",
    "CREATE TABLE x(a)",
    "DROP TABLE t",
    "CALL p()",
    "WITH n AS (SELECT 1) INSERT INTO t SELECT * FROM n",
    "SELECT a INTO x FROM t",
    "/* c */ -- c\n  insert into t values (1)"
  ]) {
    const refused = run(["-g", "sq", "-d", ":memory:", "-e", sql]);
    assert.equal(refused.status, 1, sql);
    assert.match(refused.stdout, /^status\|message\nerror\|Read-only mode: statement refused/, sql);
  }

  // Write verbs inside strings or comments do not count.
  const allowed = run(["-g", "sq", "-d", ":memory:", "-e", "SELECT 1 AS a; -- insert\nSELECT 'delete from t' AS b; EXPLAIN SELECT 1"]);
  assert.equal(allowed.status, 0, allowed.stdout);
  assert.match(allowed.stdout, /command\|1\na\n1\ncommand\|2\nb\ndelete from t\n/);
});

test("never touches server files, even with --write", () => {
  for (const sql of [
    "SELECT a FROM t INTO OUTFILE '/tmp/x'",
    "SELECT a FROM t INTO DUMPFILE '/tmp/x'",
    "LOAD DATA INFILE '/tmp/x' INTO TABLE t",
    "SELECT LOAD_FILE('/etc/passwd') AS f",
    "COPY t TO '/tmp/x'",
    "COPY (SELECT a FROM t) TO STDOUT",
    "VACUUM INTO '/tmp/x.db'",
    "ATTACH DATABASE '/tmp/x.db' AS x"
  ]) {
    const refused = sq(sql);
    assert.equal(refused.status, 1, sql);
    assert.match(refused.stdout, /^status\|message\nerror\|File access refused/, sql);
  }

  const allowed = run(["-g", "sq", "-d", ":memory:", "-e", "SELECT 'into outfile x' AS a, 'copy to' AS b"]);
  assert.equal(allowed.status, 0, allowed.stdout);
  assert.equal(allowed.stdout, "a|b\ninto outfile x|copy to\n");
});

test("blocks SELECT * on patient/person but allows it elsewhere and COUNT(*)", () => {
  for (const sql of ["SELECT * FROM person", "select distinct * from PATIENT", "SELECT a, * FROM person", "SELECT p.* FROM patient p"]) {
    const blocked = sq(`CREATE TABLE ${sql.includes("person") ? "person" : "patient"}(a); ${sql}`);
    assert.equal(blocked.status, 1, sql);
    assert.match(blocked.stdout, /^status\|message\nerror\|SELECT \* is not allowed on patient\/person/);
  }

  const other = sq("CREATE TABLE t(a); INSERT INTO t VALUES (7); SELECT * FROM t");
  assert.equal(other.status, 0);
  assert.match(other.stdout, /command\|3\na\n7\n$/);

  const allowed = sq("CREATE TABLE person(a); SELECT COUNT(*) AS total, 2 * 3 AS product FROM person");
  assert.equal(allowed.status, 0);
  assert.match(allowed.stdout, /command\|2\ntotal\|product\n0\|6\n$/);
});

const md5 = (text) => require("node:crypto").createHash("md5").update(text).digest("hex");
const H = md5("s3v"); // salted digest of 'v'

test("layer 1 rewrites PII columns in the select list to MD5(salt || col) AS col", () => {
  const pii = ["cid", "father_cid", "lname", "ec_lname", "spslname", "passport_no", "hometel", "informtel", "home_phone", "mobile_phone_number",
    "addrpart", "informaddr", "work_addr", "old_addr", "addr_soi", "addr_1"];
  const plain = ["cid_type", "lname_soundex", "fname", "hotel_x", "addressid"];
  const cols = [...pii, ...plain];
  const result = sq(
    `CREATE TABLE t(${cols.join(",")}); INSERT INTO t VALUES (${cols.map(() => "'v'").join(",")}); ` +
    `SELECT t.cid AS id, COUNT(cid) AS n, COALESCE(cid, '') AS c, cid c2, ${cols.map((c) => `t.${c}`).join(", ")} FROM t WHERE cid = 'v'`
  );
  assert.equal(result.status, 0, result.stdout);
  const header = ["id", "n", "c", "c2", ...cols].join("\\|");
  const row = [H, "1", H, H, ...pii.map(() => H), ...plain.map(() => "v")].join("\\|");
  assert.match(result.stdout, new RegExp(`command\\|3\\n${header}\\n${row}\\n$`));
});

const FIXTURE = "CREATE TABLE t(cid, fname, lname); INSERT INTO t VALUES ('v', 'v', 'v'); ";

test("layer 1 finds the select list through strings, comments and nested parens", () => {
  const cases = [
    ["SELECT 'from' AS s, cid AS x FROM t", `s|x\nfrom|${H}\n`], // `from` in a string, PII renamed
    ["SELECT /* from */ cid AS x FROM t", `x\n${H}\n`], // `from` in a comment
    ["SELECT -- from\n cid AS x FROM t", `x\n${H}\n`], // `from` in a line comment
    ["SELECT (SELECT fname FROM t) AS y, cid AS x FROM t", `y|x\nv|${H}\n`], // FROM of a subquery is at another depth
    ["SELECT MAX(cid) AS x, 'cid' AS tag FROM t", `x|tag\n${H}|cid\n`], // identifier inside a string is left alone
    ["SELECT \"cid\" FROM t", `cid\n${H}\n`], // quoted identifier: untouched by layer 1, caught by layer 2
    ["SELECT a FROM t UNION ALL SELECT cid AS a FROM t", `a\nv\n${H}\n`] // every select list in the statement
  ];
  for (const [sql, expected] of cases) {
    const result = sq("CREATE TABLE t(cid, fname, lname, a); INSERT INTO t VALUES ('v', 'v', 'v', 'v'); " + sql);
    assert.equal(result.status, 0, sql + "\n" + result.stdout);
    assert.ok(result.stdout.endsWith(`command|3\n${expected}`), sql + "\n" + result.stdout);
  }
});

test("layer 2 hashes PII-named output columns that layer 1 cannot see", () => {
  const cases = [
    ["SELECT 'v' AS cid, 'v' hometel, NULL AS lname", `cid|hometel|lname\n${H}|${H}|\n`], // aliases named like PII columns
    ["SELECT * FROM t", `cid|fname|lname\n${H}|v|${H}\n`], // star on a non patient/person table
    ["SELECT COUNT(DISTINCT lname) AS distinct_lname, COUNT(*) total_cid, SUM(LENGTH(cid)) AS len_cid, cid FROM t",
      `distinct_lname|total_cid|len_cid|cid\n1|1|32|${H}\n`], // aggregate aliases are exempt from layer 2
    ["SELECT 'from' AS s, COUNT(*) cid, cid FROM t GROUP BY cid", `s|cid|cid\nfrom|${H}|${H}\n`] // duplicate headers cancel the exemption
  ];
  for (const [sql, expected] of cases) {
    const result = sq(FIXTURE + sql);
    assert.equal(result.status, 0, sql + "\n" + result.stdout);
    assert.ok(result.stdout.endsWith(`command|3\n${expected}`), sql + "\n" + result.stdout);
  }
});

test("refuses to hash with an empty salt, before connecting when possible", () => {
  const noSalt = { DB_CLI_HASH_SALT: "" };

  const layer1 = run(["-g", "sq", "-d", ":memory:", "-e", "SELECT cid FROM t"], noSalt);
  assert.equal(layer1.status, 1);
  assert.equal(layer1.stdout, "status|message\nerror|DB_CLI_HASH_SALT is not set. Unsalted MD5 of cid/lname/phone/address can be brute-forced; set a secret salt and rerun.\n");

  const layer2 = sq(FIXTURE + "SELECT * FROM t", []);
  assert.equal(layer2.status, 0);
  const layer2NoSalt = run(["-g", "sq", "-d", ":memory:", "-w", "-e", FIXTURE + "SELECT * FROM t"], noSalt);
  assert.equal(layer2NoSalt.status, 1);
  assert.match(layer2NoSalt.stdout, /command\|3\nstatus\|message\nerror\|DB_CLI_HASH_SALT is not set/);

  const noPii = run(["-g", "sq", "-d", ":memory:", "-e", "SELECT 1 AS n"], noSalt);
  assert.equal(noPii.status, 0);
  assert.equal(noPii.stdout, "n\n1\n");
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
