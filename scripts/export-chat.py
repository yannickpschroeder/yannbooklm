#!/usr/bin/env python3
"""
Exports the current Claude Code session as readable Markdown.
Usage: python3 scripts/export-chat.py [--label "Issue #2"]
Output: docs/chat-history/YYYY-MM-DD_HH-MM_<label>.md
"""

import json
import sys
import os
import glob
from datetime import datetime, timezone

# ─── Find the session file ────────────────────────────────────────────────────

project_key = "-home-homior-yannickschroeder-yannbooklm-v2"
session_dir = os.path.expanduser(f"~/.claude/projects/{project_key}")

if not os.path.isdir(session_dir):
    print(f"Session directory not found: {session_dir}", file=sys.stderr)
    sys.exit(1)

# Pick the most recently modified JSONL file
session_files = glob.glob(os.path.join(session_dir, "*.jsonl"))
if not session_files:
    print("No session files found.", file=sys.stderr)
    sys.exit(1)

session_file = max(session_files, key=os.path.getmtime)

# ─── Parse ────────────────────────────────────────────────────────────────────

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

# ─── Extract messages ─────────────────────────────────────────────────────────

def extract_text(content) -> str:
    """Extract plain text from a message content field."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                if block.get("type") == "text":
                    parts.append(block.get("text", ""))
                elif block.get("type") == "tool_use":
                    name = block.get("name", "tool")
                    inp = block.get("input", {})
                    parts.append(f"*[Tool call: `{name}`]*")
                    # Show key inputs briefly
                    for k, v in list(inp.items())[:2]:
                        v_str = str(v)[:120].replace("\n", " ")
                        parts.append(f"  - `{k}`: {v_str}")
                elif block.get("type") == "tool_result":
                    parts.append(f"*[Tool result]*")
        return "\n".join(p for p in parts if p)
    return str(content)

messages = []
for entry in entries:
    t = entry.get("type")
    if t == "user":
        msg = entry.get("message", {})
        text = extract_text(msg.get("content", ""))
        ts = entry.get("timestamp", "")
        if text.strip():
            messages.append(("user", text.strip(), ts))
    elif t == "assistant":
        msg = entry.get("message", {})
        text = extract_text(msg.get("content", ""))
        ts = entry.get("timestamp", "")
        if text.strip():
            messages.append(("assistant", text.strip(), ts))

# ─── Render Markdown ──────────────────────────────────────────────────────────

label = " ".join(sys.argv[sys.argv.index("--label") + 1:]) if "--label" in sys.argv else "session"
safe_label = label.replace(" ", "-").replace("#", "").replace("/", "-")
now = datetime.now(timezone.utc).strftime("%Y-%m-%d_%H-%M")
out_dir = os.path.join(os.path.dirname(__file__), "..", "docs", "chat-history")
os.makedirs(out_dir, exist_ok=True)
out_file = os.path.join(out_dir, f"{now}_{safe_label}.md")

with open(out_file, "w", encoding="utf-8") as f:
    f.write(f"# Chat History — {label}\n\n")
    f.write(f"Exported: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M UTC')}\n")
    f.write(f"Session: `{os.path.basename(session_file)}`\n\n")
    f.write("---\n\n")

    for role, text, ts in messages:
        if role == "user":
            f.write(f"## 🧑 User\n\n{text}\n\n---\n\n")
        else:
            f.write(f"## 🤖 Assistant\n\n{text}\n\n---\n\n")

print(f"✓ Exported {len(messages)} messages → {out_file}")
