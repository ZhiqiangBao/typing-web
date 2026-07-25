import argparse
import http.server
import json
import os
import socket
import urllib.parse
import webbrowser

ROOT = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(ROOT, "docs")
DOC_EXTS = (".txt", ".md")
DEFAULT_PORT = 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        path = self.path.split("?", 1)[0]
        if path == "/api/docs":
            self.send_docs_list()
            return
        if path.startswith("/docs/"):
            name = path[len("/docs/"):]
            name = urllib.parse.unquote(name)
            if not self._is_safe_doc(name):
                self.send_error(403, "Forbidden")
                return
        super().do_GET()

    def end_headers(self):
        self.send_header("Cache-Control", "no-store, no-cache, must-revalidate")
        super().end_headers()

    def _is_safe_doc(self, name):
        if not name or "\x00" in name:
            return False
        if "/" in name or "\\" in name or ".." in name:
            return False
        allowed = DOC_EXTS + (".json",)
        if not name.lower().endswith(allowed):
            return False
        full = os.path.abspath(os.path.join(DOCS_DIR, name))
        return full.startswith(os.path.abspath(DOCS_DIR) + os.sep)

    def send_docs_list(self):
        files = []
        if os.path.isdir(DOCS_DIR):
            for name in sorted(os.listdir(DOCS_DIR)):
                full = os.path.join(DOCS_DIR, name)
                if os.path.isfile(full) and name.lower().endswith(DOC_EXTS):
                    files.append(name)
        payload = json.dumps(files, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def guess_type(self, path):
        ctype = super().guess_type(path)
        low = path.lower()
        if low.endswith((".txt", ".md", ".html", ".htm", ".js", ".css", ".json")):
            base = (ctype or "text/plain").split(";", 1)[0]
            return base + "; charset=utf-8"
        return ctype

    def log_message(self, fmt, *args):
        pass


def port_available(port, host="127.0.0.1"):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        try:
            s.bind((host, port))
        except OSError:
            return False
    return True


def find_port(start, host="127.0.0.1", attempts=10):
    for i in range(attempts):
        port = start + i
        if port_available(port, host):
            return port
    raise RuntimeError(f"No free port in range {start}-{start + attempts - 1}")


def main():
    parser = argparse.ArgumentParser(description="Typing Web local server")
    parser.add_argument("--port", type=int, default=DEFAULT_PORT, help="Port to listen on")
    parser.add_argument("--host", default="127.0.0.1", help="Host to bind")
    parser.add_argument("--open", action="store_true", help="Open browser after start")
    args = parser.parse_args()

    os.chdir(ROOT)
    port = args.port if port_available(args.port, args.host) else find_port(args.port, args.host)
    if port != args.port:
        print(f"Port {args.port} busy, using {port} instead.")

    server = http.server.ThreadingHTTPServer((args.host, port), Handler)
    url = f"http://{args.host}:{port}/"
    print(f"Typing app running at {url}  (Ctrl+C to stop)")

    if args.open:
        webbrowser.open(url)

    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
