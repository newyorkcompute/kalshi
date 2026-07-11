# Agent Instructions

For anything you can scope into a clean subtask, start a Composer 2.5 subagent.

Give each subagent a clear goal, the relevant context, and what to bring back. Don't have them invent the plan. Run independent pieces in parallel.

When they return, review the results before you merge anything. If something's off, rewrite the brief and spin another, don't silently patch over it yourself unless it's trivial.

## Division of Labor

- **Keep with the main agent (frontier model):** diagnosis, architecture decisions, anything ambiguous, interpreting results, and go/no-go calls.
- **Delegate to Composer 2.5 subagents:** well-specified execution — scoped PR implementation, mechanical refactors, and monitoring loops.

### Monitoring the live bot

Bot-watching is a good subagent task. Brief the subagent as strictly read-only: tail `apps/mm/logs/mm-YYYY-MM-DD.log` and `fills-YYYY-MM-DD.jsonl`, poll the control plane with GET requests only (`/health`, `/metrics`, `/state`, `/markets` on port 3001), on a fixed interval for a fixed duration. No POSTs, no order actions, no process restarts, no file edits. Have it escalate immediately on: process crash, circuit breaker or risk halt, repeated order rejections, obviously wrong fair values, or exposure over limits. Require a final report with a health verdict, event timeline, fills, and error counts. The main agent reviews the report and decides what, if anything, to do.

## Pull Requests

When opening a PR, follow `.github/PULL_REQUEST_TEMPLATE.md` section-by-section. Prefer `gh pr create --body-file` so the template is used. Mention skipped verification in the Testing section and leave related checkboxes unchecked.

Always run `npm run ci` before opening a PR. Fix failures first; do not open a PR with known CI failures.
