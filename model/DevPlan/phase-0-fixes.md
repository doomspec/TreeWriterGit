---
title: Phase 0 — Fix Existing Bugs
summary: Fix terminal resize stub and git conflict handling before building anything new.
composed_at_commit: null
---

# Phase 0 — Fix Existing Bugs

**Effort:** ~1 day  
**Prerequisite for:** everything else

## Bug 1: Terminal Resize Stub

**Location:** `view/backend/src/server.ts:375`, `view/backend/src/pty_bridge.py:23`

**Problem:** Frontend sends `{type: "resize", cols, rows}` on every window resize. Backend handler is an empty block. PTY is created once at 24×80 and never resized. Terminal display corrupts on any window size change.

**Fix:**

`pty_bridge.py` — add resize IPC via a control message on stdin:

```python
# In the select loop, detect resize control frame
# Frame format: \x1b[8;<rows>;<cols>t  (standard xterm resize escape)
import fcntl, termios, struct

def set_winsize(fd, rows, cols):
    winsize = struct.pack("HHHH", rows, cols, 0, 0)
    fcntl.ioctl(fd, termios.TIOCSWINSZ, winsize)
```

`server.ts:375` — implement the resize handler:

```typescript
if (message.type === "resize") {
  const { cols, rows } = message;
  // Write resize escape to stdin; pty_bridge.py intercepts it
  term.stdin.write(`\x1b[8;${rows};${cols}t`);
}
```

**Test:** resize browser window → terminal reflows correctly.

## Bug 2: Git Conflict Handling

**Location:** `view/backend/src/server.ts:143-162`

**Problem:** If `git rebase origin/main` encounters a merge conflict, the process exits non-zero. The error is caught and stored in `lastError`, but the repo is left in mid-rebase state. Next sync attempt will also fail. No recovery.

**Fix:**

```typescript
// After rebase failure:
try {
  await exec("git rebase --abort", { cwd: repoRoot });
} catch (_) { /* already clean */ }
gitSyncState.lastError = `Conflict on rebase — aborted. Manual merge required.`;
gitSyncState.conflictDetected = true;
```

Add `conflictDetected: boolean` to `GitSyncState`. Frontend reads it from `/api/git-sync/status` and shows a warning banner in the footer.

**Test:** create deliberate conflict between two branches → banner appears → terminal available for manual resolution.
