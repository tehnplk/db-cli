## About this repo
CLI application for  manipulate database

## RULE
Research codebase first

## Personal data
`db-cli` enforces this itself (see README "Personal data guard"): `SELECT *` is refused on `patient`/`person`, and `*cid`, `*lname`, `passport_no`, `*tel`, `*phone*`, `*addr*` columns come back as salted MD5. You may put those columns in SQL you run.
