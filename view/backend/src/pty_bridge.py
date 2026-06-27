import fcntl
import json
import os
import select
import signal
import struct
import sys
import termios

CONTROL_FD = 3


def set_winsize(fd: int, rows: int = 24, cols: int = 80) -> None:
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))


def fd_open(fd: int) -> bool:
    try:
        os.fstat(fd)
        return True
    except OSError:
        return False


def main() -> int:
    if len(sys.argv) < 3:
        print("usage: pty_bridge.py <cwd> <shell> [args...]", file=sys.stderr)
        return 2

    cwd = sys.argv[1]
    shell = sys.argv[2]
    shell_args = sys.argv[3:]
    master_fd, slave_fd = os.openpty()
    set_winsize(slave_fd)

    child_pid = os.fork()
    if child_pid == 0:
        os.setsid()
        os.chdir(cwd)
        os.dup2(slave_fd, 0)
        os.dup2(slave_fd, 1)
        os.dup2(slave_fd, 2)
        os.close(master_fd)
        os.close(slave_fd)
        if fd_open(CONTROL_FD):
            os.close(CONTROL_FD)
        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        env["COLORTERM"] = "truecolor"
        env["HISTFILE"] = "/dev/null"
        env["BASH_SILENCE_DEPRECATION_WARNING"] = "1"
        os.execvpe(shell, [shell, *shell_args], env)

    os.close(slave_fd)
    signal.signal(signal.SIGCHLD, signal.SIG_DFL)

    control_enabled = fd_open(CONTROL_FD)
    control_buf = b""
    read_fds: list = [sys.stdin.buffer, master_fd]
    if control_enabled:
        read_fds.append(CONTROL_FD)

    try:
        while True:
            readable, _, _ = select.select(read_fds, [], [])

            if control_enabled and CONTROL_FD in readable:
                try:
                    chunk = os.read(CONTROL_FD, 4096)
                except OSError:
                    chunk = b""
                if chunk:
                    control_buf += chunk
                    while b"\n" in control_buf:
                        line, control_buf = control_buf.split(b"\n", 1)
                        try:
                            msg = json.loads(line)
                            if msg.get("t") == "resize":
                                set_winsize(master_fd, int(msg["rows"]), int(msg["cols"]))
                                try:
                                    os.kill(child_pid, signal.SIGWINCH)
                                except ProcessLookupError:
                                    pass
                        except (ValueError, KeyError, OSError):
                            pass

            if sys.stdin.buffer in readable:
                data = os.read(sys.stdin.fileno(), 4096)
                if not data:
                    break
                os.write(master_fd, data)

            if master_fd in readable:
                try:
                    data = os.read(master_fd, 4096)
                except OSError:
                    break
                if not data:
                    break
                os.write(sys.stdout.fileno(), data)
                sys.stdout.flush()
    finally:
        try:
            os.kill(child_pid, signal.SIGHUP)
        except ProcessLookupError:
            pass
        os.close(master_fd)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())

