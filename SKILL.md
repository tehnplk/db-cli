---
name: db-cli
description: Execute SQL from command line for MySQL and PostgreSQL and return pipe-delimited output. Use when the user needs to run SQL quickly via `db-cli --exec`, list tables, inspect data, run write operations, or capture structured `status|message` errors without writing code.
---

# db-cli

Run SQL against MySQL or PostgreSQL using CLI options (no environment variables required).

## Installation

Install globally from GitHub:

```bash
npm install -g github:tehnplk/db-cli
```

Update to latest version:

```bash
npm install -g github:tehnplk/db-cli
```

If `db-cli` is not found, run with `.cmd` on Windows:

```bash
db-cli.cmd --help
```

## Run command

MySQL:

```bash
db-cli --engine mysql --host <host> --port <port> --user <user> --password <password> --database <database> --exec "<sql>"
```

PostgreSQL:

```bash
db-cli --engine postgres --host <host> --port <port> --user <user> --password <password> --database <database> --exec "<sql>"
```

Short form:

```bash
db-cli --engine my -u <user> -p <password> -d <database> -e "<sql>"
```

Version and skill:

```bash
db-cli --version
db-cli -v
db-cli --skill
db-cli -s
```

## Options

- `--engine <mysql|postgres>` (supports `my`, `postgresql`, `pg`; default `mysql`)
- `--vendor <mysql|postgres>` deprecated alias of `--engine`
- `--host <value>`
- `--port <value>` (default `3306` for mysql, `5432` for postgres)
- `--user, -u <value>`
- `--password, -p <value>`
- `--database, --db, -d <value>`
- `--exec, -e "<sql>"`
- `--version, -v`
- `--skill, -s` (print `SKILL.md`)

## Environment fallback

If options are not provided, use:

- `DB_ENGINE`
- `DB_VENDOR` deprecated alias of `DB_ENGINE`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

## Supported SQL operations

Supported on both MySQL and PostgreSQL:

- `CREATE`
- `INSERT`
- `UPDATE`
- `DELETE`
- `TRUNCATE`
- `DROP`

Upsert syntax by vendor:

- MySQL: `INSERT ... ON DUPLICATE KEY UPDATE ...`
- PostgreSQL: `INSERT ... ON CONFLICT (...) DO UPDATE ...`

## Output contract

Select query:

```text
col1|col2|col3
val1|val2|val3
```

Non-select query:

```text
status|affectedRows|insertId
ok|<affectedRows>|<insertId>
```

SQL/config error:

```text
status|message
error|<error message>
```

