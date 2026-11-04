#!/usr/bin/env node
"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { version } = require("../package.json");

let outputEncodingPrepared = false;

function prepareOutputEncoding() {
  if (outputEncodingPrepared) return;
  outputEncodingPrepared = true;

  if (typeof process.stdout.setDefaultEncoding === "function") {
    process.stdout.setDefaultEncoding("utf8");
  }
  if (typeof process.stderr.setDefaultEncoding === "function") {
    process.stderr.setDefaultEncoding("utf8");
  }

  if (process.platform !== "win32" || !process.stdout.isTTY || process.env.DB_CLI_SKIP_UTF8_CONSOLE === "1") {
    return;
  }

  try {
    const systemRoot = process.env.SystemRoot || process.env.windir;
    const chcpPath = systemRoot ? path.join(systemRoot, "System32", "chcp.com") : "chcp.com";
    spawnSync(chcpPath, ["65001"], {
      stdio: "ignore",
      windowsHide: true
    });
  } catch (_error) {
    // Keep output flowing even if the host terminal blocks changing code pages.
  }
}

function writeStdout(text) {
  process.stdout.write(String(text), "utf8");
}

function writeStdoutLine(text = "") {
  writeStdout(`${text}\n`);
}

function parseArgs(argv) {
  const args = {
    execSql: null,
    repeatedExec: false,
    output: null,
    host: null,
    port: null,
    user: null,
    password: null,
    database: null,
    engine: null,
    invalidOption: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--exec" || token === "-e") {
      const sql = argv[i + 1] || null;
      if (sql) {
        if (args.execSql !== null) {
          args.repeatedExec = true;
        } else {
          args.execSql = sql;
        }
      }
      i += 1;
      continue;
    }

    if (token === "--host" || token === "-H") {
      args.host = argv[i + 1] || null;
      i += 1;
      continue;
    }

    if (token === "--port" || token === "-P") {
      args.port = argv[i + 1] || null;
      i += 1;
      continue;
    }

    if (token === "--user" || token === "-u") {
      args.user = argv[i + 1] || null;
      i += 1;
      continue;
    }

    if (token === "--password" || token === "-p") {
      args.password = argv[i + 1] || null;
      i += 1;
      continue;
    }

    if (token === "--database" || token === "--db" || token === "-d") {
      args.database = argv[i + 1] || null;
      i += 1;
      continue;
    }

    if (token === "--output" || token === "-o") {
      args.output = argv[i + 1] || null;
      i += 1;
      continue;
    }

    if (token === "--engine" || token === "-g") {
      args.engine = argv[i + 1] || null;
      i += 1;
      continue;
    }

    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }

    if (token === "--version" || token === "-v") {
      args.version = true;
      continue;
    }

    if (token === "--skill" || token === "-s") {
      args.skill = true;
      continue;
    }

    if (token === "--write" || token === "-w") {
      args.write = true;
      continue;
    }

    if (token.startsWith("-") && !args.invalidOption) {
      args.invalidOption = token;
    }
  }

  return args;
}

function normalizeEngine(input) {
  const raw = String(input || "mysql").toLowerCase();

  if (raw === "mysql" || raw === "my") return "mysql";
  if (raw === "postgres" || raw === "postgresql" || raw === "pg") return "postgres";
  if (raw === "sqlite" || raw === "sqlite3" || raw === "sq") return "sqlite";
  return "";
}

function printHelp() {
  [
    "Usage:",
    '  db-cli -g mysql -H localhost -P 3306 -u root -p secret -d app -e "SELECT id, name FROM users"',
    '  db-cli -g my -u root -d app -w -e "CREATE TABLE t(id INT); INSERT INTO t VALUES (1); SELECT id FROM t;"',
    '  db-cli -g postgres -H localhost -P 5432 -u postgres -p secret -d app -e "SELECT id, name FROM users"',
    '  db-cli -g pg -u postgres -d app -w -e "CREATE TABLE t(id INT); INSERT INTO t VALUES (1); SELECT id FROM t;"',
    '  db-cli -g sqlite -d app.sqlite -w -e "CREATE TABLE t(id INTEGER); INSERT INTO t VALUES (1); SELECT id FROM t;"',
    '  db-cli -g my -u root -d app -e "SELECT id, name FROM users" --output users.txt',
    '  db-cli -g my -u root -d app -e "SELECT id, name FROM users" > users.txt',
    '  db-cli --engine mysql --host localhost --port 3306 --user root --password secret --database app --exec "SELECT id, name FROM users"',
    '  db-cli --engine postgres --host localhost --port 5432 --user postgres --password secret --database app --exec "SELECT id, name FROM users"',
    '  db-cli --engine sqlite --database app.sqlite --exec "SELECT id, name FROM users"',
    "  db-cli -v | --version",
    "  db-cli -s | --skill",
    "",
    "Command options:",
    "  -g, --engine <mysql|postgres|sqlite>  Database engine (aliases: my, pg, sq; default: mysql)",
    "  -H, --host <value>             Database host",
    "  -P, --port <value>             Database port",
    "  -u, --user <value>             Database user",
    "  -p, --password <value>         Database password",
    "  -d, --database, --db <value>   Database name, or SQLite database file path",
    '  -e, --exec "sql"               SQL to execute (single -e only, use ";" for multistatement)',
    "  -o, --output <path>            Write output to UTF-8 text file (pipe-delimited)",
    "  -w, --write                    Allow INSERT/UPDATE/DELETE/DDL/CALL (default: read-only, SELECT/SHOW/EXPLAIN only)",
    "  -v, --version                  Show CLI version",
    "  -s, --skill                    Print SKILL.md",
    "  -h, --help                     Show help",
    "",
    "Environment variables:",
    "  DB_ENGINE (default: mysql)",
    "  DB_HOST (default: localhost)",
    "  DB_PORT (default: 3306 for mysql, 5432 for postgres; ignored for sqlite)",
    "  DB_USER (required for mysql/postgres)",
    "  DB_PASSWORD (default: empty)",
    "  DB_NAME (required; SQLite database file path for sqlite)",
    "  DB_CLI_SKIP_UTF8_CONSOLE=1 (Windows: do not switch terminal output to UTF-8)",
    "  DB_CLI_HASH_SALT (secret prepended before MD5 of cid/lname/phone/address columns; required when SQL touches them)"
  ].forEach(writeStdoutLine);
}

function printSkill() {
  const skillPath = path.resolve(__dirname, "..", "SKILL.md");
  const content = fs.readFileSync(skillPath, "utf8");
  writeStdout(content);
}

function toCell(value) {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function getErrorMessage(error) {
  if (!error) return "Unknown error";
  if (typeof error === "string") return error;
  if (error.name === "AggregateError" && Array.isArray(error.errors) && error.errors.length > 0) {
    return error.errors.map((err) => getErrorMessage(err)).join(" | ");
  }

  const message = typeof error.message === "string" ? error.message.trim() : "";
  if (message) return message;

  if (typeof error.code === "string" && error.code.trim()) {
    return error.code;
  }

  return String(error);
}

function collectHeaders(rows, fields) {
  let headers = fields
    .map((field) => (field && typeof field.name === "string" ? field.name : ""))
    .filter(Boolean);

  if (headers.length === 0 && Array.isArray(rows) && rows.length > 0 && rows[0] && typeof rows[0] === "object" && !Array.isArray(rows[0])) {
    headers = Object.keys(rows[0]);
  }

  return headers;
}

class BufferedOutStream {
  constructor(outputPath) {
    this.outputPath = outputPath;
    this.buffer = [];
    this.bufferBytes = 0;
    this.fileDescriptor = outputPath ? fs.openSync(outputPath, "w") : null;
  }

  write(text) {
    const value = String(text);
    this.buffer.push(value);
    this.bufferBytes += Buffer.byteLength(value, "utf8");
    if (this.bufferBytes >= 64 * 1024) {
      this.flush();
    }
  }

  flush() {
    if (this.buffer.length > 0) {
      const payload = this.buffer.join("");
      if (this.fileDescriptor !== null) {
        fs.writeSync(this.fileDescriptor, payload, null, "utf8");
      } else {
        writeStdout(payload);
      }
      this.buffer.length = 0;
      this.bufferBytes = 0;
    }
  }

  close() {
    this.flush();
    if (this.fileDescriptor !== null) {
      fs.closeSync(this.fileDescriptor);
      this.fileDescriptor = null;
    }
  }
}

function writeResultOutput(outStream, result, safeHeaders = new Set()) {
  if (result.type === "rows") {
    const headers = collectHeaders(result.rows, result.fields);
    if (headers.length === 0) {
      writeErrorOutput(outStream, "Unable to render result table");
      return;
    }

    const numHeaders = headers.length;
    // Duplicate header names (`COUNT(*) cid, cid`) make an aggregate alias ambiguous: hash them all.
    const exempt = new Set(headers).size === numHeaders ? safeHeaders : new Set();
    const piiHeader = headers.map((name) => isPiiColumn(name) && !exempt.has(name.toLowerCase()));
    if (!HASH_SALT && piiHeader.some(Boolean)) {
      throw new Error(SALT_REQUIRED_MESSAGE);
    }

    outStream.write(headers.join("|") + "\n");
    const lines = [];
    for (const row of result.rows) {
      const cells = new Array(numHeaders);
      for (let j = 0; j < numHeaders; j++) {
        cells[j] = toCell(row[headers[j]]);
        if (piiHeader[j]) cells[j] = hashCell(cells[j]);
      }
      lines.push(cells.join("|"));
      if (lines.length === 1000) {
        outStream.write(lines.join("\n") + "\n");
        lines.length = 0;
      }
    }
    if (lines.length > 0) {
      outStream.write(lines.join("\n") + "\n");
    }
  } else {
    outStream.write("status|affectedRows|insertId\n");
    outStream.write(`ok|${result.affectedRows}|${result.insertId}\n`);
  }
}

function writeErrorOutput(outStream, message) {
  const safeMessage = message || "Unknown error";
  outStream.write("status|message\n");
  outStream.write(`error|${toCell(safeMessage)}\n`);
}

function asMysqlRowsResult(rows, fields) {
  if (!Array.isArray(rows) || !Array.isArray(fields)) {
    return null;
  }

  // Standard SELECT shape: fields is ColumnDefinition[]
  if (fields.length > 0 && fields.every((field) => field && typeof field.name === "string")) {
    return { rows, fields };
  }

  // Stored procedure/CALL shape: fields is ColumnDefinition[][]
  for (let i = 0; i < fields.length; i += 1) {
    const fieldSet = fields[i];
    const rowSet = rows[i];
    if (Array.isArray(fieldSet) && fieldSet.length > 0 && Array.isArray(rowSet)) {
      return { rows: rowSet, fields: fieldSet };
    }
  }

  return null;
}

function splitSqlStatements(sqlText) {
  const statements = [];
  let current = "";
  let quoteChar = "";
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag = "";
  let wordBuffer = "";
  let createWindow = 0;
  let inCompoundObject = false;
  let beginDepth = 0;

  function consumeWord() {
    if (!wordBuffer) return;
    const word = wordBuffer.toLowerCase();
    wordBuffer = "";

    if (createWindow > 0) {
      createWindow -= 1;
    }

    if (word === "create") {
      createWindow = 10;
      return;
    }

    if (createWindow > 0 && (word === "procedure" || word === "function" || word === "trigger" || word === "event")) {
      inCompoundObject = true;
      beginDepth = 0;
      createWindow = 0;
      return;
    }

    if (inCompoundObject) {
      if (word === "begin") {
        beginDepth += 1;
      } else if (word === "end" && beginDepth > 0) {
        beginDepth -= 1;
      }
    }
  }

  for (let i = 0; i < sqlText.length; i += 1) {
    const ch = sqlText[i];
    const next = i + 1 < sqlText.length ? sqlText[i + 1] : "";

    current += ch;

    if (inLineComment) {
      if (ch === "\n") {
        inLineComment = false;
      }
      continue;
    }

    if (inBlockComment) {
      if (ch === "*" && next === "/") {
        current += "/";
        i += 1;
        inBlockComment = false;
      }
      continue;
    }

    if (dollarTag) {
      if (sqlText.startsWith(dollarTag, i)) {
        if (dollarTag.length > 1) {
          current += dollarTag.slice(1);
        }
        i += dollarTag.length - 1;
        dollarTag = "";
      }
      continue;
    }

    if (quoteChar) {
      if (ch === "\\" && quoteChar === "'" && i + 1 < sqlText.length) {
        current += sqlText[i + 1];
        i += 1;
        continue;
      }

      if (ch === quoteChar) {
        if ((quoteChar === "'" || quoteChar === "\"") && next === quoteChar) {
          current += next;
          i += 1;
          continue;
        }
        quoteChar = "";
      }
      continue;
    }

    if ((ch >= "A" && ch <= "Z") || (ch >= "a" && ch <= "z") || ch === "_") {
      wordBuffer += ch;
    } else if (wordBuffer) {
      consumeWord();
    }

    if (ch === "-" && next === "-") {
      current += "-";
      i += 1;
      inLineComment = true;
      continue;
    }

    if (ch === "/" && next === "*") {
      current += "*";
      i += 1;
      inBlockComment = true;
      continue;
    }

    if (ch === "'" || ch === "\"" || ch === "`") {
      quoteChar = ch;
      continue;
    }

    if (ch === "$") {
      const rest = sqlText.slice(i);
      const match = rest.match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/);
      if (match) {
        dollarTag = match[0];
        if (dollarTag.length > 1) {
          current += dollarTag.slice(1);
        }
        i += dollarTag.length - 1;
        continue;
      }
    }

    if (ch === ";") {
      if (inCompoundObject && beginDepth > 0) {
        continue;
      }

      const trimmed = current.trim();
      if (trimmed !== ";") {
        const statement = trimmed.slice(0, -1).trim();
        if (statement) {
          statements.push(statement);
        }
      }
      current = "";
      wordBuffer = "";
      if (inCompoundObject) {
        inCompoundObject = false;
        beginDepth = 0;
      }
      createWindow = 0;
    }
  }

  if (wordBuffer) {
    consumeWord();
  }

  const tail = current.trim();
  if (tail) {
    statements.push(tail);
  }

  return statements;
}

// Matches `SELECT *`, `SELECT DISTINCT *`, `, *`, `alias.*` on masked text (strings and comments
// blanked); `COUNT(*)` passes because `*` follows `(`.
const SELECT_STAR_RE = /(?:\bselect|\bdistinct|,|\.)\s*\*/i;
const PII_TABLE_RE = /\b(?:patient|person)\b/i;

function assertNoSelectStar(sql) {
  const masked = maskLiterals(sql);
  if (SELECT_STAR_RE.test(masked) && PII_TABLE_RE.test(masked)) {
    throw new Error("SELECT * is not allowed on patient/person. List columns explicitly (COUNT(*) is fine).");
  }
}

// PII columns, by name. Covered: *cid (cid, father_cid, sps_cid...), *lname (lname, ec_lname,
// spslname...), passport_no, *tel (hometel, worktel, informtel), *phone* (home_phone,
// mobile_phone_number), *addr* (addrpart, informaddr, work_addr, addr_1...) but not addressid.
const PII_COLUMN_RE = /^(?:\w*cid|\w*lname|passport_no|\w*tel|\w*phone\w*|\w*addr(?!ess)\w*)$/i;
const HASH_SALT = process.env.DB_CLI_HASH_SALT || "";
const MD5_HEX_RE = /^[0-9a-f]{32}$/i;
const SALT_REQUIRED_MESSAGE = "DB_CLI_HASH_SALT is not set. Unsalted MD5 of cid/lname/phone/address can be brute-forced; set a secret salt and rerun.";

// Read-only by default. A statement may run without --write only when it starts with a read
// keyword and contains no write verb (a CTE can wrap INSERT/UPDATE/DELETE) and no INTO target
// (Postgres `SELECT ... INTO newtable`, MySQL `INTO OUTFILE`); `INTO @var` is fine.
const READ_KEYWORDS = new Set(["select", "with", "show", "describe", "desc", "explain", "pragma", "values"]);
const LEADING_NOISE_RE = /^(?:\s+|--[^\n]*(?:\n|$)|\/\*[\s\S]*?\*\/)+/;
const WRITE_VERB_RE = /\b(?:insert|update|delete|merge|replace|create|alter|drop|truncate|call|grant|revoke)\b/i;
const INTO_TARGET_RE = /\binto\s+(?!@)/i;

function statementPreview(sql) {
  return sql.replace(LEADING_NOISE_RE, "").slice(0, 40).replace(/\s+/g, " ");
}

function assertReadOnly(sql) {
  const body = maskLiterals(sql).replace(LEADING_NOISE_RE, "");
  const keyword = (body.match(/^[A-Za-z]+/) || [""])[0].toLowerCase();
  if (!READ_KEYWORDS.has(keyword) || WRITE_VERB_RE.test(body) || INTO_TARGET_RE.test(body)) {
    throw new Error(`Read-only mode: statement refused (${statementPreview(sql)}...). Add --write/-w to allow writes.`);
  }
}

// Server-side file access is refused even with --write: it would carry raw values past layer 2
// (MySQL INTO OUTFILE/DUMPFILE, LOAD DATA, LOAD_FILE; Postgres COPY ... TO, pg_read_file;
// SQLite VACUUM INTO, ATTACH).
const FILE_IO_RE = /\binto\s+(?:outfile|dumpfile)\b|\bload\s+data\b|\bload_file\s*\(|\bcopy\b[\s\S]*\bto\b|\bpg_read_\w*\s*\(|\bvacuum\s+into\b|\battach\b/i;

function assertNoFileIo(sql) {
  if (FILE_IO_RE.test(maskLiterals(sql))) {
    throw new Error(`File access refused (${statementPreview(sql)}...): statements that read or write server files are never allowed.`);
  }
}

function isPiiColumn(name) {
  return PII_COLUMN_RE.test(name);
}

// Layer 2 (output): hash a cell of a PII-named column. Skips values that are already an MD5
// digest so a cell hashed by layer 1 is not hashed twice.
function hashCell(value) {
  if (value === "" || MD5_HEX_RE.test(value)) return value;
  return crypto.createHash("md5").update(HASH_SALT + value, "utf8").digest("hex");
}

// Same-length copy of `sql` with string contents, quoted identifiers and comments blanked, so
// keyword and identifier scans never match inside them. Delimiting quotes are kept in place.
function maskLiterals(sql) {
  const out = sql.split("");
  let i = 0;
  while (i < sql.length) {
    const ch = sql[i];
    const next = sql[i + 1];
    if (ch === "-" && next === "-") {
      while (i < sql.length && sql[i] !== "\n") out[i++] = " ";
      continue;
    }
    if (ch === "/" && next === "*") {
      const end = sql.indexOf("*/", i + 2);
      const stop = end === -1 ? sql.length : end + 2;
      while (i < stop) out[i++] = " ";
      continue;
    }
    if (ch === "'" || ch === "\"" || ch === "`") {
      i += 1;
      while (i < sql.length) {
        if (ch === "'" && sql[i] === "\\") {
          out[i++] = " ";
          if (i < sql.length) out[i++] = " ";
          continue;
        }
        if (sql[i] === ch) {
          if (sql[i + 1] !== ch) break;
          out[i++] = " ";
        }
        out[i++] = " ";
      }
      i += 1;
      continue;
    }
    if (ch === "$") {
      const tag = /^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/.exec(sql.slice(i));
      if (tag) {
        const end = sql.indexOf(tag[0], i + tag[0].length);
        const stop = end === -1 ? sql.length : end + tag[0].length;
        while (i < stop) out[i++] = " ";
        continue;
      }
    }
    i += 1;
  }
  return out.join("");
}

// Layer 1 (SQL): wrap PII column references inside every select list in MD5(salt || col) so raw
// values never leave the engine. Same digest as hashCell for text columns.
// A select list runs from SELECT to the FROM at the same paren depth (or the closing paren / end),
// found on the masked text, so `from` in a string, comment or EXTRACT(... FROM ...) cannot end it.
const TOKEN_RE = /\(|\)|\b[A-Za-z_]\w*\b/g;
const IDENTIFIER_RE = /\b((?:\w+\.)?)([A-Za-z_]\w*)\b/g;

function selectListRanges(masked) {
  const ranges = [];
  const open = [];
  let depth = 0;
  for (const m of masked.matchAll(TOKEN_RE)) {
    const token = m[0];
    if (token === "(") {
      depth += 1;
      continue;
    }
    if (token === ")") {
      while (open.length && open[open.length - 1].depth === depth) ranges.push({ ...open.pop(), end: m.index });
      depth -= 1;
      continue;
    }
    const word = token.toLowerCase();
    if (word === "select") {
      open.push({ depth, start: m.index + token.length });
    } else if (word === "from" && open.length && open[open.length - 1].depth === depth) {
      ranges.push({ ...open.pop(), end: m.index });
    }
  }
  while (open.length) ranges.push({ ...open.pop(), end: masked.length });
  return ranges;
}

function sqlLiteral(text) {
  return `'${text.replace(/'/g, "''")}'`;
}

function hashSql(engine, column) {
  return engine === "mysql"
    ? `MD5(CONCAT(${sqlLiteral(HASH_SALT)}, ${column}))`
    : `MD5(${sqlLiteral(HASH_SALT)} || ${column})`;
}

function parenDepth(text) {
  let depth = 0;
  for (const ch of text) {
    if (ch === "(") depth += 1;
    else if (ch === ")") depth -= 1;
  }
  return depth;
}

// Aliases of COUNT/SUM/AVG are numeric aggregates, never a raw value, so layer 2 may skip them
// even when named like a PII column (e.g. `COUNT(DISTINCT lname) AS distinct_lname`).
// ponytail: regex with two levels of nested parens; deeper nesting just falls back to hashing.
const AGGREGATE_ALIAS_RE = /\b(?:count|sum|avg)\s*\((?:[^()]|\((?:[^()]|\([^()]*\))*\))*\)\s+(?:as\s+)?([A-Za-z_]\w*)/gi;

function aggregateAliases(sql) {
  return new Set(Array.from(maskLiterals(sql).matchAll(AGGREGATE_ALIAS_RE), (m) => m[1].toLowerCase()));
}

// An identifier right after `)`, a literal, a number or a plain word (`AS`, `END`, a column) is an
// alias (`COUNT(*) total_cid`, `x AS cid`), not a column. Words that introduce an expression are excluded.
const ALIAS_CONTEXT_RE = /(?:\)|'|"|`|\d|\b(?!(?:select|distinct|all|case|when|then|else|and|or|not|like|in|is|between|escape|collate)\b)[A-Za-z_]\w*)\s+$/i;

function encryptPiiInSql(sql, engine) {
  const masked = maskLiterals(sql);
  const ranges = selectListRanges(masked);
  const innermost = (offset) =>
    ranges
      .filter((r) => r.start <= offset && offset < r.end)
      .sort((a, b) => a.end - a.start - (b.end - b.start))[0];

  let out = "";
  let last = 0;
  for (const m of masked.matchAll(IDENTIFIER_RE)) {
    const [match, prefix, name] = m;
    const range = isPiiColumn(name) ? innermost(m.index) : undefined;
    if (!range) continue;
    const before = masked.slice(range.start, m.index);
    if (ALIAS_CONTEXT_RE.test(before)) continue;
    const after = masked.slice(m.index + match.length, range.end);
    const wrapped = hashSql(engine, prefix + name);
    const bareItem = parenDepth(before) === 0 && /^\s*(?:,|$)/.test(after);
    out += sql.slice(last, m.index) + (bareItem ? `${wrapped} AS ${name}` : wrapped);
    last = m.index + match.length;
  }
  return out + sql.slice(last);
}

function resolveConfig(args) {
  const engine = normalizeEngine(args.engine || process.env.DB_ENGINE || "mysql");

  if (!engine) {
    throw new Error("Invalid --engine. Use mysql/my, postgres/pg, or sqlite/sq.");
  }

  const defaultPort = engine === "postgres" ? 5432 : 3306;
  const port = engine === "sqlite" ? null : Number(args.port || process.env.DB_PORT || defaultPort);

  if (engine !== "sqlite" && !Number.isFinite(port)) {
    throw new Error("Invalid DB port.");
  }

  const config = {
    engine,
    host: args.host || process.env.DB_HOST || "localhost",
    port,
    user: args.user || process.env.DB_USER,
    password: args.password || process.env.DB_PASSWORD || "",
    database: args.database || process.env.DB_NAME
  };

  if (!config.database) {
    throw new Error("Missing database name. Use --database or DB_NAME.");
  }

  if (engine !== "sqlite" && !config.user) {
    throw new Error("Missing database user. Use --user or DB_USER.");
  }

  return config;
}

async function executeMysql(config, sqlList, onResult) {
  const mysql = require("mysql2/promise");
  let connection;
  try {
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      charset: "utf8mb4",
      multipleStatements: false
    });

    for (let i = 0; i < sqlList.length; i += 1) {
      const sql = sqlList[i];
      const [rows, fields] = await connection.query(sql);

      const rowsResult = asMysqlRowsResult(rows, fields);
      if (rowsResult) {
        onResult({ type: "rows", rows: rowsResult.rows, fields: rowsResult.fields }, i);
        continue;
      }

      onResult({
        type: "status",
        affectedRows: rows.affectedRows || 0,
        insertId: rows.insertId || ""
      }, i);
    }
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function executePostgres(config, sqlList, onResult) {
  const { Client } = require("pg");
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database
  });

  try {
    await client.connect();
    await client.query("SET client_encoding TO 'UTF8'");
    for (let i = 0; i < sqlList.length; i += 1) {
      const sql = sqlList[i];
      const result = await client.query(sql);

      if (Array.isArray(result.rows) && result.fields && result.fields.length > 0) {
        onResult({ type: "rows", rows: result.rows, fields: result.fields }, i);
        continue;
      }

      onResult({
        type: "status",
        affectedRows: result.rowCount || 0,
        insertId: ""
      }, i);
    }
  } finally {
    try {
      await client.end();
    } catch (_error) {
      // Ignore close errors to preserve original failure message.
    }
  }
}

async function executeSqlite(config, sqlList, onResult) {
  const Database = require("better-sqlite3");
  const db = new Database(config.database);
  // SQLite has no MD5(); match MySQL/Postgres so the cid rewrite works everywhere.
  db.function("md5", (value) => (value === null ? null : crypto.createHash("md5").update(String(value), "utf8").digest("hex")));

  try {
    for (let i = 0; i < sqlList.length; i += 1) {
      const sql = sqlList[i];
      const statement = db.prepare(sql);

      if (statement.reader) {
        const fields = statement.columns().map((column) => ({ name: column.name }));
        onResult({ type: "rows", rows: statement.iterate(), fields }, i);
        continue;
      }

      const result = statement.run();
      onResult({
        type: "status",
        affectedRows: result.changes || 0,
        insertId: result.lastInsertRowid === undefined ? "" : result.lastInsertRowid
      }, i);
    }
  } finally {
    try {
      db.close();
    } catch (_error) {
      // An open iterator makes close() throw; keep the original error instead.
    }
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    prepareOutputEncoding();
    writeStdoutLine(version);
    process.exit(0);
  }

  if (args.skill) {
    prepareOutputEncoding();
    printSkill();
    process.exit(0);
  }

  if (args.invalidOption) {
    if (!args.output) prepareOutputEncoding();
    const outStream = new BufferedOutStream(args.output);
    writeErrorOutput(outStream, `Unknown option: ${args.invalidOption}. Run --help or --skill for usage.`);
    outStream.close();
    process.exit(1);
  }

  if (args.repeatedExec) {
    if (!args.output) prepareOutputEncoding();
    const outStream = new BufferedOutStream(args.output);
    writeErrorOutput(outStream, 'Multiple --exec/-e are not allowed. Use one -e with ";" for multistatement.');
    outStream.close();
    process.exit(1);
  }

  let sqlStatements = splitSqlStatements(args.execSql || "");

  if (args.help || sqlStatements.length === 0) {
    prepareOutputEncoding();
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  if (!args.output) prepareOutputEncoding();
  const outStream = new BufferedOutStream(args.output);
  try {
    const config = resolveConfig(args);
    sqlStatements.forEach(assertNoSelectStar);
    sqlStatements.forEach(assertNoFileIo);
    if (!args.write) sqlStatements.forEach(assertReadOnly);
    const safeHeaders = sqlStatements.map(aggregateAliases);
    const rewritten = sqlStatements.map((sql) => encryptPiiInSql(sql, config.engine));
    if (!HASH_SALT && rewritten.some((sql, i) => sql !== sqlStatements[i])) {
      throw new Error(SALT_REQUIRED_MESSAGE);
    }
    sqlStatements = rewritten;
    const onResult = (result, index) => {
      if (sqlStatements.length > 1) {
        outStream.write(`command|${index + 1}\n`);
      }
      writeResultOutput(outStream, result, safeHeaders[index]);
    };

    if (config.engine === "postgres") {
      await executePostgres(config, sqlStatements, onResult);
    } else if (config.engine === "sqlite") {
      await executeSqlite(config, sqlStatements, onResult);
    } else {
      await executeMysql(config, sqlStatements, onResult);
    }
    outStream.close();
  } catch (error) {
    writeErrorOutput(outStream, getErrorMessage(error));
    outStream.close();
    process.exit(1);
  }
}

run();
