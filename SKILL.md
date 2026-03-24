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

Short form (recommended):

```bash
db-cli -g my -H <host> -P <port> -u <user> -p <password> -d <database> -e "<sql>"
```

Long form:

MySQL:

```bash
db-cli --engine mysql --host <host> --port <port> --user <user> --password <password> --database <database> --exec "<sql>"
```

PostgreSQL:

```bash
db-cli --engine postgres --host <host> --port <port> --user <user> --password <password> --database <database> --exec "<sql>"
```

Version and skill:

```bash
db-cli -v
db-cli --version
db-cli -s
db-cli --skill
```
## Options

- `-g, --engine <mysql|postgres>` (supports `my`, `postgresql`, `pg`; default `mysql`)
- `-H, --host <value>`
- `-P, --port <value>` (default `3306` for mysql, `5432` for postgres)
- `-u, --user <value>`
- `-p, --password <value>`
- `-d, --database, --db <value>`
- `-e, --exec "<sql>"`
- `-v, --version`
- `-s, --skill` (print `SKILL.md`)
- `-h, --help`
## Environment fallback

If options are not provided, use:

- `DB_ENGINE`
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
