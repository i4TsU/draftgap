"""Run a command under a Linux child subreaper when the container init does not reap."""

from __future__ import annotations

import ctypes
import os
import signal
import subprocess
import sys
import time


def main() -> int:
    if not sys.platform.startswith("linux"):
        return subprocess.call(sys.argv[1:])
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(36, 1, 0, 0, 0) != 0:  # PR_SET_CHILD_SUBREAPER
        raise OSError(ctypes.get_errno(), "Unable to enable child subreaping")
    command = subprocess.Popen(sys.argv[1:])

    def forward(signum, _frame):
        try:
            os.kill(command.pid, signum)
        except ProcessLookupError:
            pass

    signal.signal(signal.SIGINT, forward)
    signal.signal(signal.SIGTERM, forward)
    outcome = None
    deadline = None
    while True:
        try:
            pid, status = os.waitpid(-1, os.WNOHANG)
        except ChildProcessError:
            if outcome is None:
                raise RuntimeError("Command exit status was not collected")
            return outcome if outcome >= 0 else 128 - outcome
        if pid == command.pid:
            outcome = os.waitstatus_to_exitcode(status)
            command.returncode = outcome
            deadline = time.monotonic() + 5
        if pid == 0:
            if deadline is not None and time.monotonic() >= deadline:
                print("Command left living descendants after exit.", file=sys.stderr)
                return outcome if outcome and outcome > 0 else 1
            time.sleep(0.01)


if __name__ == "__main__":
    raise SystemExit(main())
