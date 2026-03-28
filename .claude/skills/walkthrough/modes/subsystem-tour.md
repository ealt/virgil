# Focused Subsystem Tour

## Scoping

1. **Find relevant files:** Grep for the keyword (`$ARGUMENTS`) across the codebase
2. **Filter:** Only include files directly relevant to the subsystem — resist the urge to explain the whole codebase
3. **Trace:** Follow the subsystem's execution flow or data flow from entry to exit

## Frontmatter

Point-in-time mode only unless the user specifies a comparison. Do **not** include base references by default.

## Structure

1. **What it does** (informational) — Brief explanation of the subsystem's purpose and role in the larger system
2. **Entry point** — Where this subsystem is invoked or where data enters
3. **Core logic** — Main implementation, using `###` sub-steps for distinct phases or components
4. **Integration points** — Where this subsystem connects to others (calls out, is called by, shared state)
5. **Summary** (informational) — Key takeaways and pointers to related subsystems

## Tips

- Narrow scope: 5-10 files maximum for a focused tour
- Follow the data — trace how input flows through the subsystem to output
- Name steps after what the code *does*, not file names (e.g., "Validate JWT claims" not "jwt.ts")
- If the subsystem spans many files, group by responsibility using hierarchy
