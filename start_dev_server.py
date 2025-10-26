#!/usr/bin/env python3
"""Start the Flask dev server on the first available port."""

from __future__ import annotations

import socket
import sys
import threading
import time
import webbrowser

from importlib import import_module
from pathlib import Path

TRY_PORTS = [5000, 5050, 5051]
PROJECT_ROOT = Path(__file__).resolve().parent
SRC_ROOT = PROJECT_ROOT / "src"
for path in (PROJECT_ROOT, SRC_ROOT):
    str_path = str(path)
    if str_path not in sys.path:
        sys.path.insert(0, str_path)


def port_is_open(port: int) -> bool:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as sock:
        sock.settimeout(0.2)
        return sock.connect_ex(("127.0.0.1", port)) == 0


def choose_port() -> int:
    for port in TRY_PORTS:
        if port == 0:
            return 0
        if not port_is_open(port):
            return port
    return 0


def open_browser_when_ready(port: int) -> None:
    url = f"http://127.0.0.1:{port}/main"
    for _ in range(50):
        if port_is_open(port):
            time.sleep(0.5)
            webbrowser.open(url, new=2)
            return
        time.sleep(0.2)
        



def main():
    port = choose_port()
    print(f"Starting Flask server on {port}. Press Ctrl+C to stop.")

    threading.Thread(target=open_browser_when_ready, args=(port,), daemon=True).start()

    app_module = import_module("src.webapp")
    flask_app = getattr(app_module, "app")

    # 👇 demp request-logging ("GET /... 200 -")
    import logging

    logging.getLogger("werkzeug").setLevel(logging.WARNING)

    flask_app.run(host="127.0.0.1", port=port, debug=True, use_reloader=False)
    #flask_app.run(host="0.0.0.0", port=port, debug=True, use_reloader=False)


if __name__ == "__main__":
    main()
