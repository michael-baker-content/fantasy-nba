from __future__ import annotations

import http.server
from pathlib import Path


PORT = 8765
PROJECT_ROOT = Path(__file__).resolve().parents[1]


class ReusableThreadingHTTPServer(http.server.ThreadingHTTPServer):
    allow_reuse_address = True


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    protocol_version = "HTTP/1.0"

    def log_message(self, format: str, *args: object) -> None:
        return


def main() -> None:
    handler = lambda *args, **kwargs: QuietHandler(  # noqa: E731
        *args,
        directory=str(PROJECT_ROOT),
        **kwargs,
    )
    with ReusableThreadingHTTPServer(("127.0.0.1", PORT), handler) as server:
        print(f"Serving http://127.0.0.1:{PORT}/web/")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print("\nServer stopped.")


if __name__ == "__main__":
    main()
