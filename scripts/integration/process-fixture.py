"""Offline process-tree fixture for shutdown regression tests."""

from __future__ import annotations

import json
import os
import signal
import socket
import subprocess
import sys
import time


def main() -> None:
    mode = sys.argv[1]
    if mode == "leaf":
        signal.signal(signal.SIGTERM, signal.SIG_IGN)
        with socket.socket() as listener:
            listener.bind(("127.0.0.1", 0))
            listener.listen()
            print(
                json.dumps({"pid": os.getpid(), "port": listener.getsockname()[1]}),
                flush=True,
            )
            time.sleep(120)
        return
    child = subprocess.Popen(
        [sys.executable, __file__, "leaf"], stdout=subprocess.PIPE, text=True
    )
    assert child.stdout is not None
    address = json.loads(child.stdout.readline())
    print(json.dumps({"pid": os.getpid(), "leaf": address}), flush=True)
    if mode == "cooperative":
        sys.stdin.readline()
        child.kill()
        child.wait(timeout=5)
    else:
        # Deliberately never reads stdin, like a service stuck during initialization.
        time.sleep(120)


if __name__ == "__main__":
    main()
