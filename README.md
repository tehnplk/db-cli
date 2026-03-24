# db-cli

Simple Node.js CLI for executing MySQL SQL.

## Usage

```bash
db-cli --host localhost --port 3306 --user root --password secret --database app --exec "SELECT id, name FROM users"
```

Short options:

```bash
db-cli -u root -p secret -d app -e "SELECT id, name FROM users"
```

## Options

- `--host <value>`
- `--port <value>`
- `--user, -u <value>`
- `--password, -p <value>`
- `--database, --db, -d <value>`
- `--exec, -e "sql"`

## Environment fallback

If an option is not provided in command line, it falls back to env vars:

- `DB_HOST` (default `localhost`)
- `DB_PORT` (default `3306`)
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

For non-select SQL (insert/update/delete):

```text
status|affectedRows|insertId
ok|1|0
```
