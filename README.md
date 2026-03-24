# db-cli

Simple Node.js CLI for executing SQL on MySQL and PostgreSQL.

## Installation

Install globally from GitHub:

```bash
npm i -g github:tehnplk/db-cli
```

Update to latest version:

```bash
npm i -g github:tehnplk/db-cli
```

Check installed version:

```bash
db-cli -v
```

If `db-cli` is not found on Windows, use:

```bash
db-cli.cmd -v
```

## Usage

MySQL:

```bash
db-cli --engine mysql --host localhost --port 3306 --user root --password secret --database app --exec "SELECT id, name FROM users"
```

PostgreSQL:

```bash
db-cli --engine postgres --host localhost --port 5432 --user postgres --password secret --database app --exec "SELECT id, name FROM users"
```

Short options:

```bash
db-cli --engine my -u root -p secret -d app -e "SELECT id, name FROM users"
```

## Options

- `--engine <mysql|postgres>` (aliases: `my`, `pg`; default: `mysql`)
- `--vendor <mysql|postgres>` deprecated alias of `--engine`
- `--host <value>`
- `--port <value>`
- `--user, -u <value>`
- `--password, -p <value>`
- `--database, --db, -d <value>`
- `--exec, -e "sql"`
- `--version, -v`
- `--skill, -s` (print `SKILL.md`)

## Environment fallback

If an option is not provided in command line, it falls back to env vars:

- `DB_ENGINE` (default `mysql`)
- `DB_VENDOR` deprecated alias of `DB_ENGINE`
- `DB_HOST` (default `localhost`)
- `DB_PORT` (default `3306` for mysql, `5432` for postgres)
- `DB_USER`
- `DB_PASSWORD` (default empty)
- `DB_NAME`

## Output format

Query results are printed as pipe-delimited text:

```text
id|name
1|Alice
2|Bob
```

For non-select SQL (insert/update/delete/create/drop/truncate):

```text
status|affectedRows|insertId
ok|1|
```

For SQL/config errors:

```text
status|message
error|<error message>
```

