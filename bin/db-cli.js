#!/usr/bin/env node
"use strict";

const mysql = require("mysql2/promise");
const { version } = require("../package.json");

function parseArgs(argv) {
  const args = {
    execSql: null,
    host: null,
    port: null,
    user: null,
    password: null,
    database: null
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

    if (token === "--help" || token === "-h") {
      args.help = true;
      continue;
    }

    if (token === "--version" || token === "-v") {
      args.version = true;
    }
  }

  return args;
}

function printHelp() {
  console.log("Usage:");
  console.log('  db-cli --host localhost --port 3306 --user root --password secret --database app --exec "SELECT * FROM users"');
  console.log('  db-cli -u root -p secret -d app -e "SELECT * FROM users"');
  console.log("  db-cli --version");
  console.log("");
  console.log("Command options:");
  console.log("  --host <value>        MySQL host");
  console.log("  --port <value>        MySQL port");
  console.log("  --user, -u <value>    MySQL user");
  console.log("  --password, -p <val>  MySQL password");
  console.log("  --database, --db, -d  Database name");
  console.log('  --exec, -e "sql"      SQL to execute');
  console.log("  --version, -v         Show CLI version");
  console.log("");
  console.log("Environment variables:");
  console.log("  DB_HOST (default: localhost)");
  console.log("  DB_PORT (default: 3306)");
  console.log("  DB_USER (required)");
  console.log("  DB_PASSWORD (default: empty)");
  console.log("  DB_NAME (required)");
}

function toCell(value) {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
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
  console.log(`error|${toCell(message)}`);
}

async function run() {
  const args = parseArgs(process.argv.slice(2));

  if (args.version) {
    console.log(version);
    process.exit(0);
  }

  if (args.help || !args.execSql) {
    printHelp();
    process.exit(args.help ? 0 : 1);
  }

  const config = {
    host: args.host || process.env.DB_HOST || "localhost",
    port: Number(args.port || process.env.DB_PORT || 3306),
    user: args.user || process.env.DB_USER,
    password: args.password || process.env.DB_PASSWORD || "",
    database: args.database || process.env.DB_NAME,
    multipleStatements: false
  };

  if (!config.user || !config.database) {
    printError("Missing MySQL user or database. Use --user/--database or DB_USER/DB_NAME.");
    process.exit(1);
  }

  let connection;
  try {
    connection = await mysql.createConnection(config);
    const [rows, fields] = await connection.execute(args.execSql);

    if (Array.isArray(rows) && Array.isArray(fields)) {
      printTable(rows, fields);
    } else {
      console.log("status|affectedRows|insertId");
      console.log(`ok|${rows.affectedRows || 0}|${rows.insertId || 0}`);
    }
  } catch (error) {
    printError(error.message);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

run();
