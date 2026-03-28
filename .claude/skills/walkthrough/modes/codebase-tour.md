# Codebase Tour

## Analysis

Before writing, explore:
- Directory structure and organization patterns
- Entry points (main files, command registration, route definitions)
- Key abstractions and interfaces
- Dependencies and how components connect

## Frontmatter

Point-in-time mode only — do **not** include base references (`baseBranch`, `baseCommit`, `pr`) in frontmatter.

## Structure

1. **Welcome/overview** (informational) — What the project does, who it's for, what you'll learn
2. **Project structure** (informational) — Directory layout with brief descriptions
3. **Entry point** — Where execution starts, bootstrap/initialization flow
4. **Core concepts** — Major abstractions, one `##` per concept with `###` sub-steps for details
5. **Common patterns** — Recurring patterns new readers should recognize (error handling, data flow, etc.)
6. **Summary** (informational) — Recap and pointers to deeper walkthroughs or docs

## Tips

- Use `##` for major areas, `###` for specifics within each area
- Start broad and zoom in — readers should understand the big picture before details
- Include a directory tree in the project structure step's body (as a code block)
- Link between steps when concepts reference each other
