## About this repo
CLI application for  manipulate database

## RULE
Research codebase first

## Personal data
`db-cli` enforces this itself (see README "Personal data guard" and SKILL.md "Sensitive columns"): `SELECT *` is refused on `patient`/`person`, and `*cid`, `*lname`, `passport_no`, `*tel`, `*phone*`, `*addr*` columns come back to you as MD5. Write and test the real SQL, hand the user that same SQL, never try to recover a value from a digest.
