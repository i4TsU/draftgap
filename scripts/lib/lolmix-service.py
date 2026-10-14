"""Run the real loopback LoLMix service with an owned stdin shutdown channel."""

from __future__ import annotations

import sys
import threading

from lolmix import server


def main() -> None:
    httpd = server.create_server("127.0.0.1", 8765)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    print("LoLMix listening on http://127.0.0.1:8765", flush=True)
    try:
        sys.stdin.readline()
    except KeyboardInterrupt:
        pass
    finally:
        httpd.shutdown()
        httpd.server_close()
        thread.join(timeout=5)


if __name__ == "__main__":
    main()
