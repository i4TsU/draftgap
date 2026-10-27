"""Run the real loopback LoLMix service with an owned stdin shutdown channel."""

from __future__ import annotations

import sys
import threading

from lolmix import server


def main() -> None:
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8765
    httpd = server.create_server("127.0.0.1", port)
    thread = threading.Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    print(f"LoLMix listening on http://127.0.0.1:{port}", flush=True)
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
