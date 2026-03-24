# db-cli Skill

## Purpose

Run MySQL SQL from command line and print pipe-delimited output.

## Command

```bash
db-cli --host <host> --port <port> --user <user> --password <password> --database <db> --exec "<sql>"
```

Short form:

```bash
db-cli -u <user> -p <password> -d <db> -e "<sql>"
```

## Output format

Select query:

```text
header1|header2|header3
value1|value2|value3
```

Non-select query:

```text
status|affectedRows|insertId
ok|<affectedRows>|<insertId>
```

Error:

```text
status|message
error|<error message>
```

## Example

```bash
db-cli --host localhost --port 3306 --user root --password 112233 --database hosxp_pcu --exec "SHOW TABLES;"
```
