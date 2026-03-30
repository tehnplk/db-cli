#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const { version } = require("../package.json");

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
  return "";
}

function printHelp() {
  console.log("Usage:");
  console.log('  db-cli -g mysql -H localhost -P 3306 -u root -p secret -d app -e "SELECT * FROM users"');
  console.log('  db-cli -g my -u root -d app -e "CREATE TABLE t(id INT); INSERT INTO t VALUES (1); SELECT * FROM t;"');
  console.log('  db-cli -g postgres -H localhost -P 5432 -u postgres -p secret -d app -e "SELECT * FROM users"');
  console.log('  db-cli -g pg -u postgres -d app -e "CREATE TABLE t(id INT); INSERT INTO t VALUES (1); SELECT * FROM t;"');
  console.log('  db-cli -g my -u root -d app -e "SELECT * FROM users" --output users.txt');
  console.log('  db-cli -g my -u root -d app -e "SELECT * FROM users" > users.txt');
  console.log('  db-cli --engine mysql --host localhost --port 3306 --user root --password secret --database app --exec "SELECT * FROM users"');
  console.log('  db-cli --engine postgres --host localhost --port 5432 --user postgres --password secret --database app --exec "SELECT * FROM users"');
  console.log("  db-cli -v | --version");
  console.log("  db-cli -s | --skill");
  console.log("");
  console.log("Command options:");
  console.log("  -g, --engine <mysql|postgres>  Database engine (aliases: my, pg; default: mysql)");
  console.log("  -H, --host <value>             Database host");
  console.log("  -P, --port <value>             Database port");
  console.log("  -u, --user <value>             Database user");
  console.log("  -p, --password <value>         Database password");
  console.log("  -d, --database, --db <value>   Database name");
  console.log('  -e, --exec "sql"               SQL to execute (single -e only, use ";" for multistatement)');
  console.log("  -o, --output <path>            Write output to UTF-8 text file (pipe-delimited)");
  console.log("  -v, --version                  Show CLI version");
  console.log("  -s, --skill                    Print SKILL.md");
  console.log("  -h, --help                     Show help");
  console.log("");
  console.log("Environment variables:");
  console.log("  DB_ENGINE (default: mysql)");
  console.log("  DB_HOST (default: localhost)");
  console.log("  DB_PORT (default: 3306 for mysql, 5432 for postgres)");
  console.log("  DB_USER (required)");
  console.log("  DB_PASSWORD (default: empty)");
  console.log("  DB_NAME (required)");
}

function printSkill() {
  const skillPath = path.resolve(__dirname, "..", "SKILL.md");
  const content = fs.readFileSync(skillPath, "utf8");
  console.log(content);
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
    if (outputPath) {
      fs.writeFileSync(this.outputPath, "");
    }
  }

  write(text) {
    this.buffer.push(text);
    if (this.buffer.length >= 10000) {
      this.flush();
    }
  }

  flush() {
    if (this.buffer.length > 0) {
      const payload = this.buffer.join("");
      if (this.outputPath) {
        fs.appendFileSync(this.outputPath, payload, "utf8");
      } else {
        process.stdout.write(payload);
      }
      this.buffer.length = 0;
    }
  }
}

function writeResultOutput(outStream, result) {
  if (result.type === "rows") {
    const headers = collectHeaders(result.rows, result.fields);
    if (headers.length === 0) {
      writeErrorOutput(outStream, "Unable to render result table");
      return;
    }

    outStream.write(headers.join("|") + "\n");
    const numHeaders = headers.length;
    for (let i = 0; i < result.rows.length; i++) {
      let line = "";
      const row = result.rows[i];
      for (let j = 0; j < numHeaders; j++) {
        if (j > 0) line += "|";
        line += toCell(row[headers[j]]);
      }
      outStream.write(line + "\n");
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

function resolveConfig(args) {
  const engine = normalizeEngine(args.engine || process.env.DB_ENGINE || "mysql");

  if (!engine) {
    throw new Error("Invalid --engine. Use mysql/my or postgres/pg.");
  }

  const defaultPort = engine === "postgres" ? 5432 : 3306;
  const port = Number(args.port || process.env.DB_PORT || defaultPort);

  if (!Number.isFinite(port)) {
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

  if (!config.user || !config.database) {
    throw new Error("Missing database user or database name. Use --user/--database or DB_USER/DB_NAME.");
  }

  return config;
}

async function executeMysql(config, sqlList) {
  const mysql = require("mysql2/promise");
  let connection;
  const results = [];
  try {
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      multipleStatements: false
    });

    for (const sql of sqlList) {
      const [rows, fields] = await connection.query(sql);

      const rowsResult = asMysqlRowsResult(rows, fields);
      if (rowsResult) {
        results.push({ type: "rows", rows: rowsResult.rows, fields: rowsResult.fields });
        continue;
      }

      results.push({
        type: "status",
        affectedRows: rows.affectedRows || 0,
        insertId: rows.insertId || ""
      });
    }

    return results;
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function executePostgres(config, sqlList) {
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
    const results = [];

    for (const sql of sqlList) {
      const result = await client.query(sql);

      if (Array.isArray(result.rows) && result.fields && result.fields.length > 0) {
        results.push({ type: "rows", rows: result.rows, fields: result.fields });
        continue;
      }

      results.push({
        type: "status",
        affectedRows: result.rowCount || 0,
        insertId: ""
      });
    }

    return results;
  } finally {
    try {
      await client.end();
    } catch (_error) {
      // Ignore close errors to preserve original failure message.
    }
  }
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    console.log(version);
    process.exit(0);
  }

  if (args.skill) {
    printSkill();
    process.exit(0);
  }

  if (args.invalidOption) {
    const outStream = new BufferedOutStream(args.output);
    writeErrorOutput(outStream, `Unknown option: ${args.invalidOption}. Run --help or --skill for usage.`);
    outStream.flush();
    process.exit(1);
  }

  if (args.repeatedExec) {
    const outStream = new BufferedOutStream(args.output);
    writeErrorOutput(outStream, 'Multiple --exec/-e are not allowed. Use one -e with ";" for multistatement.');
    outStream.flush();
    process.exit(1);
  }

  const sqlStatements = splitSqlStatements(args.execSql || "");

  if (args.help || sqlStatements.length === 0) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const outStream = new BufferedOutStream(args.output);
  try {
    const config = resolveConfig(args);
    const results = config.engine === "postgres"
      ? await executePostgres(config, sqlStatements)
      : await executeMysql(config, sqlStatements);

    for (let i = 0; i < results.length; i += 1) {
      if (results.length > 1) {
        outStream.write(`command|${i + 1}\n`);
      }
      writeResultOutput(outStream, results[i]);
    }
    outStream.flush();
  } catch (error) {
    writeErrorOutput(outStream, getErrorMessage(error));
    outStream.flush();
    process.exit(1);
  }
}

run();
