# Setup/Implementation Guide

## Approach

Structure the walkthrough chronologically — the reader follows steps in order to achieve a goal (setting up a dev environment, implementing a feature, configuring a system).

## Frontmatter

Point-in-time mode only. Do **not** include base references unless the guide specifically compares before/after states.

## Structure

1. **Prerequisites** (informational) — What the reader needs before starting: tools, access, background knowledge
2. **Configuration** — Config files, environment variables, or settings to create/modify. Include the actual config content in code blocks within the step body.
3. **Step-by-step implementation** — Use `##` for major phases, `###` for individual steps within each phase. Each step points to the relevant code location.
4. **Verification/testing** — How to confirm the implementation works. Point to test files or show commands to run.

## Tips

- Use hierarchy for multi-phase setups: `##` per phase, `###` per step within
- Include shell commands or config snippets in step bodies (as fenced code blocks) for anything the reader needs to run or create
- Each step should be independently verifiable where possible — "after this step, you should see X"
- Link to prerequisite steps when later steps depend on earlier ones
