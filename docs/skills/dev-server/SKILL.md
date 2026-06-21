---
name: dev-server
description: Start the Next.js dev server in the background and monitor its logs for errors. Use when the user asks to start the server, watch logs, or debug runtime errors.
---

# Dev Server — Start & Monitor

Start the Next.js dev server and stream errors from its log file.

## Steps

### 1. Kill any existing server on port 3000

```bash
fuser -k 3000/tcp 2>/dev/null || true
sleep 1
```

### 2. Start the server using Bash run_in_background

Use the Bash tool with `run_in_background: true`. Save the background task ID — the output file path is needed for the Monitor in step 4.

Load the correct Node version via nvm before starting:

```
Bash(
  command:           "fuser -k 3000/tcp 2>/dev/null || true; sleep 1; source ~/.nvm/nvm.sh && nvm use && npm run dev",
  run_in_background: true
)
```

The tool returns a task ID and output path like:
`/tmp/claude-1000/.../tasks/<id>.output`

Save this path — it is used in step 4.

### 3. Wait until the server responds

```bash
until curl -s -o /dev/null -w "%{http_code}" http://localhost:3000 | grep -qE "200|302|307"; do sleep 1; done && echo "Server ready"
```

### 4. Print the output path

```bash
echo "To create /dev-agents use the command \"/dev-agent {AGENT_NAME} <output-path-from-step-2>\""
```

### 4. Start the persistent Monitor

Filter the log for errors and warnings only — do not emit every line.

```
Monitor(
  command:     "tail -f <output-path-from-step-2> 2>&1 | grep -E --line-buffered -i 'error|warn|failed|unhandled|exception|TypeError|ReferenceError|SyntaxError|cannot'",
  description: "Next.js dev server errors and warnings",
  persistent:  true
)
```

## On error notification

When the Monitor fires:

1. Read the last 60 lines of the log for full context:
   ```bash
   tail -60 .next/dev/logs/next-development.log
   ```
2. Identify root cause (missing table → DrizzleAdapter; JWEInvalid → session strategy mismatch; 42P01 → wrong table name, etc.)
3. Fix the code, verify with `npm run typecheck && npm run lint`
4. Inform the user of what was fixed.

## Important rules

- **Never print .env values** — only check key existence: `grep -q "KEY" .env && echo set || echo missing`
- Do not use `&` in Bash tool calls — use `run_in_background: true` or the Node spawn approach above
- `nohup ... &` and `... &` both fail with exit code 144 in this environment — always use the Node spawn detach pattern
