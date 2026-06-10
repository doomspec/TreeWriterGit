import fcntl
import os
import select
import signal
import struct
import sys
import termios


def set_winsize(fd: int, rows: int = 24, cols: int = 80) -> None:
    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", rows, cols, 0, 0))


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
        env = os.environ.copy()
        env["TERM"] = "xterm-256color"
        env["COLORTERM"] = "truecolor"
        env["HISTFILE"] = "/dev/null"
        env["BASH_SILENCE_DEPRECATION_WARNING"] = "1"
        os.execvpe(shell, [shell, *shell_args], env)

    os.close(slave_fd)
    signal.signal(signal.SIGCHLD, signal.SIG_DFL)

    try:
        while True:
            readable, _, _ = select.select([sys.stdin.buffer, master_fd], [], [])

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

