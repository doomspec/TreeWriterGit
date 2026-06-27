#!/usr/bin/env python3
"""Run a shell command under a pseudo-TTY for agent CLIs that refuse dumb/non-TTY stdin."""
import os
import pty
import sys


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: dispatch_run.py <cwd> <command>", file=sys.stderr)
        return 2

    cwd = sys.argv[1]
    command = sys.argv[2]
    os.chdir(cwd)

    env = os.environ.copy()
    env["TERM"] = "xterm-256color"
    env["COLORTERM"] = "truecolor"
    env.setdefault("CI", "1")
    os.environ.clear()
    os.environ.update(env)

    try:
        return pty.spawn(["/bin/bash", "-lc", command])
    except OSError as exc:
        print(str(exc), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
