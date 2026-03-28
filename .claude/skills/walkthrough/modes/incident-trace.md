# Incident/Debugging Trace

## Approach

Structure the walkthrough as an investigation narrative — the reader should follow the same reasoning path that leads to the root cause.

## Frontmatter

Include `incident: <id>` in frontmatter metadata if an incident ID is known. This becomes a metadata field in the converted walkthrough.

## Structure

1. **Symptom** (informational or with location) — What was observed? Error messages, unexpected behavior, metrics anomaly
2. **Where to look** — Starting point for investigation based on the symptom. Show the code that's most likely involved.
3. **Evidence chain** — Each step shows code that was examined and what was learned. Use `###` sub-steps to group hypothesis → supporting evidence.
4. **Root cause** — The specific code (with location) that caused the issue, with explanation of *why* it fails
5. **Fix/mitigation** — The fix or workaround, with location pointing to the corrected code (or suggested fix location)

## Tips

- Each step should advance the reader's understanding — don't include dead ends unless they teach something
- Use hierarchy to group related investigation threads (e.g., `## Network layer investigation` with `### Connection pooling` and `### Timeout handling` underneath)
- Include relevant log output, error messages, or metrics in code blocks within step bodies
- If the incident is ongoing, the last step can be "Current status" rather than "Fix"
