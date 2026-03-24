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
    host: null,
    port: null,
    user: null,
    password: null,
    database: null,
    vendor: null
  };

  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];

    if (token === "--exec" || token === "-e") {
      args.execSql = argv[i + 1] || null;
      i += 1;
      continue;
    }

    if (token === "--host") {
      args.host = argv[i + 1] || null;
      i += 1;
      continue;
    }

    if (token === "--port") {
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

    if (token === "--vendor") {
      args.vendor = argv[i + 1] || null;
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
    }
  }

  return args;
}

function normalizeVendor(input) {
  const raw = String(input || "mysql").toLowerCase();

  if (raw === "mysql" || raw === "my") return "mysql";
  if (raw === "postgres" || raw === "postgresql" || raw === "pg") return "postgres";
  return "";
}

function printHelp() {
  console.log("Usage:");
  console.log('  db-cli --vendor mysql --host localhost --port 3306 --user root --password secret --database app --exec "SELECT * FROM users"');
  console.log('  db-cli --vendor postgres --host localhost --port 5432 --user postgres --password secret --database app --exec "SELECT * FROM users"');
  console.log('  db-cli --vendor mysql -u root -p secret -d app -e "SELECT * FROM users"');
  console.log("  db-cli --version");
  console.log("  db-cli --skill");
  console.log("");
  console.log("Command options:");
  console.log("  --vendor <mysql|postgres>  Database vendor (aliases: my, pg; default: mysql)");
  console.log("  --host <value>             Database host");
  console.log("  --port <value>             Database port");
  console.log("  --user, -u <value>         Database user");
  console.log("  --password, -p <val>       Database password");
  console.log("  --database, --db, -d       Database name");
  console.log('  --exec, -e "sql"           SQL to execute');
  console.log("  --version, -v              Show CLI version");
  console.log("  --skill, -s                Print SKILL.md");
  console.log("");
  console.log("Environment variables:");
  console.log("  DB_VENDOR (default: mysql)");
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
  if (error.message) return error.message;
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

function resolveConfig(args) {
  const vendor = normalizeVendor(args.vendor || process.env.DB_VENDOR || "mysql");

  if (!vendor) {
    throw new Error("Invalid --vendor. Use mysql/my or postgres/pg.");
  }

  const defaultPort = vendor === "postgres" ? 5432 : 3306;
  const port = Number(args.port || process.env.DB_PORT || defaultPort);

  if (!Number.isFinite(port)) {
    throw new Error("Invalid DB port.");
  }

  const config = {
    vendor,
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

async function executeMysql(config, sql) {
  let connection;
  try {
    connection = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      multipleStatements: false
    });

    const [rows, fields] = await connection.execute(sql);

    if (Array.isArray(rows) && Array.isArray(fields)) {
      return { type: "rows", rows, fields };
    }

    return {
      type: "status",
      affectedRows: rows.affectedRows || 0,
      insertId: rows.insertId || ""
    };
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

async function executePostgres(config, sql) {
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database
  });

  try {
    await client.connect();
    const result = await client.query(sql);

    if (Array.isArray(result.rows) && result.fields && result.fields.length > 0) {
      return { type: "rows", rows: result.rows, fields: result.fields };
    }

    return {
      type: "status",
      affectedRows: result.rowCount || 0,
      insertId: ""
    };
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

  if (args.help || !args.execSql) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  try {
    const config = resolveConfig(args);
    const result = config.vendor === "postgres"
      ? await executePostgres(config, args.execSql)
      : await executeMysql(config, args.execSql);

    if (result.type === "rows") {
      printTable(result.rows, result.fields);
    } else {
      console.log("status|affectedRows|insertId");
      console.log(`ok|${result.affectedRows}|${result.insertId}`);
    }
  } catch (error) {
    printError(getErrorMessage(error));
    process.exit(1);
  }
}

run();
