---
name: dev-agent
description: Monitor a log file for task assignments addressed to a named agent. When a matching task line appears, grill the user to clarify requirements, then implement the fix. Usage: /dev-agent <name> <log-path>
---

# Dev Agent — Monitor & Resolve Tasks

Monitor a log file for task assignments, grill the user for requirements, then fix.

## 1. Parse arguments

The skill receives two space-separated arguments:
- `name` — the agent name to watch for (e.g. `backend`)
- `log_path` — absolute path to the log file to monitor (e.g. `/tmp/tasks.log`)

Extract them from the args string. If either is missing, ask the user to re-invoke with both arguments: `/dev-agent <name> <log-path>`.

## 2. Confirm and start monitoring

Tell the user: "Watching `<log_path>` for tasks addressed to agent `<name>`."

Start a **persistent** Monitor that filters for the task marker:

```
Monitor(
  command:     "tail -f <log_path> 2>&1 | grep --line-buffered -F '[Task] Agent <name>: '",
  description: "Task assignments for agent <name>",
  persistent:  true
)
```

Keep working / wait for notifications. Do NOT poll or sleep.

## 3. On task notification

When the Monitor fires with a matching line:

### 3a. Extract the task

The matched line has the form:
```
[Task] Agent <name>: <task description>
```

Extract `<task description>` — everything after the colon and first space.

### 3b. Announce the task

Tell the user:
> **New task detected:** `<task description>`
> Starting grilling session to clarify requirements before implementation.

### 3c. Grill the user

Follow the **grilling skill** behavior with `<task description>` as the plan:

- Interview the user relentlessly about every aspect of the task
- Walk down each branch of the design tree, resolving dependencies one by one
- Provide your recommended answer for each question
- Ask **one question at a time**, waiting for the answer before continuing
- If a question can be answered by exploring the codebase, explore it instead of asking

Continue until you have a shared, unambiguous understanding of what needs to be built.

### 3d. Implement the fix

Once grilling is complete:

1. Summarise the agreed requirements in 2–3 bullet points
2. Implement the solution following the project's conventions
3. Run any relevant type-check, lint, or test commands to verify
4. Report what was changed

### 3e. Resume monitoring

After the fix is done, the Monitor is still running — continue waiting for the next task notification.

## Rules

- Never implement before grilling is complete — requirements must be clear first
- If the log file does not exist yet, inform the user and wait; do not error out
- One task at a time: if a second task arrives while grilling/implementing the first, queue it and handle it after the current one is resolved
