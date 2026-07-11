# Agent Instructions

For anything you can scope into a clean subtask, start a Composer 2.5 subagent.

Give each subagent a clear goal, the relevant context, and what to bring back. Don't have them invent the plan. Run independent pieces in parallel.

When they return, review the results before you merge anything. If something's off, rewrite the brief and spin another, don't silently patch over it yourself unless it's trivial.

## Pull Requests

When opening a PR, follow `.github/PULL_REQUEST_TEMPLATE.md` section-by-section. Prefer `gh pr create --body-file` so the template is used. Mention skipped verification in the Testing section and leave related checkboxes unchecked.

Always run `npm run ci` before opening a PR. Fix failures first; do not open a PR with known CI failures.
