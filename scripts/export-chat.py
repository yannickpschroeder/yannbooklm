#!/usr/bin/env python3
"""
Incrementally exports new Claude Code messages since the last export.
Usage:  python3 scripts/export-chat.py --label "Issue #2"
Output: docs/chat-history/YYYY-MM-DD_HH-MM_<label>.md

State is persisted in docs/chat-history/.export-state.json so each run
only includes messages that arrived after the previous export.
"""

import json
import sys
import os
import glob
from datetime import datetime, timezone

# ─── Config ───────────────────────────────────────────────────────────────────

PROJECT_KEY = "-home-homior-yannickschroeder-yannbooklm-v2"
SESSION_DIR = os.path.expanduser(f"~/.claude/projects/{PROJECT_KEY}")
OUT_DIR = os.path.join(os.path.dirname(__file__), "..", "docs", "chat-history")
STATE_FILE = os.path.join(OUT_DIR, ".export-state.json")

# ─── Find session file ────────────────────────────────────────────────────────

if not os.path.isdir(SESSION_DIR):
    print(f"Session directory not found: {SESSION_DIR}", file=sys.stderr)
    sys.exit(1)

# Prefer the current session via CLAUDE_CODE_SESSION_ID env var.
# Falls back to most-recently-modified file when called outside a Claude session.
env_session_id = os.environ.get("CLAUDE_CODE_SESSION_ID")
if env_session_id:
    candidate = os.path.join(SESSION_DIR, f"{env_session_id}.jsonl")
    if os.path.isfile(candidate):
        session_file = candidate
    else:
        print(f"Session file not found for ID {env_session_id}, falling back to newest.", file=sys.stderr)
        session_files = glob.glob(os.path.join(SESSION_DIR, "*.jsonl"))
        session_file = max(session_files, key=os.path.getmtime) if session_files else None
else:
    session_files = glob.glob(os.path.join(SESSION_DIR, "*.jsonl"))
    session_file = max(session_files, key=os.path.getmtime) if session_files else None

if not session_file:
    print("No session files found.", file=sys.stderr)
    sys.exit(1)

session_id = os.path.basename(session_file)

# ─── Load state ───────────────────────────────────────────────────────────────

os.makedirs(OUT_DIR, exist_ok=True)

state: dict = {}
if os.path.exists(STATE_FILE):
    with open(STATE_FILE, encoding="utf-8") as f:
        state = json.load(f)

last_uuid: str | None = state.get("last_uuid")

# ─── Parse session ────────────────────────────────────────────────────────────

entries = []
with open(session_file, encoding="utf-8") as f:
    for line in f:
        line = line.strip()
        if not line:
            continue
        try:
            entries.append(json.loads(line))
        except json.JSONDecodeError:
            continue

# ─── Extract text ─────────────────────────────────────────────────────────────

def extract_text(content) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "text":
                parts.append(block.get("text", ""))
            elif block.get("type") == "tool_use":
                name = block.get("name", "tool")
                inp = block.get("input", {})
                parts.append(f"*[Tool: `{name}`]*")
                for k, v in list(inp.items())[:2]:
                    parts.append(f"  - `{k}`: {str(v)[:120].replace(chr(10), ' ')}")
        return "\n".join(p for p in parts if p)
    return str(content)

# ─── Filter to new messages only ──────────────────────────────────────────────

all_messages = []
for entry in entries:
    t = entry.get("type")
    if t not in ("user", "assistant"):
        continue
    msg = entry.get("message", {})
    text = extract_text(msg.get("content", "")).strip()
    if not text:
        continue
    all_messages.append({
        "role": t,
        "text": text,
        "uuid": entry.get("uuid", ""),
        "timestamp": entry.get("timestamp", ""),
    })

# Find slice start: everything after last_uuid.
# If last_uuid was from a different session file (e.g. after context compaction), reset to 0.
last_session_id = state.get("session_id")
if last_uuid and last_session_id and last_session_id == os.path.basename(session_file):
    start_idx = next(
        (i + 1 for i, m in enumerate(all_messages) if m["uuid"] == last_uuid),
        len(all_messages),  # uuid gone? export nothing
    )
elif last_uuid:
    # Different session file — include everything from this new session
    start_idx = 0
else:
    start_idx = 0  # first export ever

new_messages = all_messages[start_idx:]

if not new_messages:
    print("No new messages since last export. Nothing to write.")
    sys.exit(0)

# ─── Write Markdown ───────────────────────────────────────────────────────────

label = " ".join(sys.argv[sys.argv.index("--label") + 1:]) if "--label" in sys.argv else "session"
safe_label = label.replace(" ", "-").replace("#", "").replace("/", "-")
now = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M")
out_file = os.path.join(OUT_DIR, f"{now}_{safe_label}.md")

with open(out_file, "w", encoding="utf-8") as f:
    f.write(f"# Chat History — {label}\n\n")
    f.write(f"Exported: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n")
    f.write(f"Session: `{session_id}` · {len(new_messages)} new messages\n\n")
    f.write("---\n\n")
    for m in new_messages:
        icon = "🧑" if m["role"] == "user" else "🤖"
        role = "User" if m["role"] == "user" else "Assistant"
        f.write(f"## {icon} {role}\n\n{m['text']}\n\n---\n\n")

# ─── Persist state ────────────────────────────────────────────────────────────

state["last_uuid"] = new_messages[-1]["uuid"]
state["last_export"] = now
state["session_id"] = session_id

with open(STATE_FILE, "w", encoding="utf-8") as f:
    json.dump(state, f, indent=2)

print(f"✓ Exported {len(new_messages)} new messages → {out_file}")
