#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const path = require("node:path");
const mysql = require("mysql2/promise");
const { Client } = require("pg");
const { version } = require("../package.json");

function parseArgs(argv) {
  const args = {
    execSql: null,
    repeatedExec: false,
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

function printTable(rows, fields) {
  const headers = fields.map((field) => field.name);
  console.log(headers.join("|"));

  for (const row of rows) {
    const line = headers.map((header) => toCell(row[header])).join("|");
    console.log(line);
  }
}

function printError(message) {
  console.log("status|message");
  console.log(`error|${toCell(message || "Unknown error")}`);
}

function splitSqlStatements(sqlText) {
  const statements = [];
  let current = "";
  let quoteChar = "";
  let inLineComment = false;
  let inBlockComment = false;
  let dollarTag = "";

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
      const trimmed = current.trim();
      if (trimmed !== ";") {
        const statement = trimmed.slice(0, -1).trim();
        if (statement) {
          statements.push(statement);
        }
      }
      current = "";
    }
  }

  const tail = current.trim();
  if (tail) {
    statements.push(tail);
  }

  return statements;
}

function printResult(result) {
  if (result.type === "rows") {
    printTable(result.rows, result.fields);
    return;
  }

  console.log("status|affectedRows|insertId");
  console.log(`ok|${result.affectedRows}|${result.insertId}`);
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
      const [rows, fields] = await connection.execute(sql);

      if (Array.isArray(rows) && Array.isArray(fields)) {
        results.push({ type: "rows", rows, fields });
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
    printError(`Unknown option: ${args.invalidOption}. Run --help or --skill for usage.`);
    process.exit(1);
  }

  if (args.repeatedExec) {
    printError('Multiple --exec/-e are not allowed. Use one -e with ";" for multistatement.');
    process.exit(1);
  }

  const sqlStatements = splitSqlStatements(args.execSql || "");

  if (args.help || sqlStatements.length === 0) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  try {
    const config = resolveConfig(args);
    const results = config.engine === "postgres"
      ? await executePostgres(config, sqlStatements)
      : await executeMysql(config, sqlStatements);

    for (let i = 0; i < results.length; i += 1) {
      if (results.length > 1) {
        console.log(`command|${i + 1}`);
      }
      printResult(results[i]);
    }
  } catch (error) {
    printError(getErrorMessage(error));
    process.exit(1);
  }
}

run();
