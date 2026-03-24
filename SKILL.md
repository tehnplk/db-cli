---
name: db-cli
description: Execute SQL from command line for MySQL and PostgreSQL and return pipe-delimited output. Use when the user needs to run SQL quickly via `db-cli --exec`, list tables, inspect data, or capture structured `status|message` errors without writing code.
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
db-cli --vendor mysql --host <host> --port <port> --user <user> --password <password> --database <database> --exec "<sql>"
```

PostgreSQL:

```bash
db-cli --vendor postgres --host <host> --port <port> --user <user> --password <password> --database <database> --exec "<sql>"
```

Short form:

```bash
db-cli --vendor mysql -u <user> -p <password> -d <database> -e "<sql>"
```

Version:

```bash
db-cli --version
db-cli -v
```

## Options

- `--vendor <mysql|postgres>` (supports `postgresql`, `pg`; default `mysql`)
- `--host <value>`
- `--port <value>` (default `3306` for mysql, `5432` for postgres)
- `--user, -u <value>`
- `--password, -p <value>`
- `--database, --db, -d <value>`
- `--exec, -e "<sql>"`
- `--version, -v`

## Environment fallback

If options are not provided, use:

- `DB_VENDOR`
- `DB_HOST`
- `DB_PORT`
- `DB_USER`
- `DB_PASSWORD`
- `DB_NAME`

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
