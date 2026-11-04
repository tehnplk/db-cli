## About this repo
CLI application for  manipulate database

## RULE
Research codebase first

## Forbidden columns while testing queries (strict)
These rules apply when you yourself run a query against a database to test it:
- Never put `cid`, `idcard`, `lname`, or `lastname` (any case, any table alias, e.g. `p.cid`) in the SQL you run — SELECT, WHERE, JOIN, ORDER BY, INSERT, UPDATE, anything.
- Never use `SELECT *` (or `alias.*`) on any table; always list the columns explicitly.

Once the test returns the expected result, the final SQL you hand over (to the agent or into the codebase):
- Must add `lname` back where the task needs it. You write it in; do not run it.
- Must still leave out `cid`, `idcard`, and `lastname`. If the task needs one, tell the user (in Thai) to add it themselves: name the exact file in this codebase and the line where the SQL lives, as a clickable link like [SKILL.md:62](SKILL.md#L62). If the SQL is not saved in a file, save it to a file in the codebase first, then send that link.

