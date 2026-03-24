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
