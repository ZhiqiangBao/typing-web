import http.server
import json
import os

ROOT = os.path.dirname(os.path.abspath(__file__))
DOCS_DIR = os.path.join(ROOT, "docs")
DOC_EXTS = (".txt", ".md")
PORT = 8000


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=ROOT, **kwargs)

    def do_GET(self):
        if self.path.split("?", 1)[0] == "/api/docs":
            self.send_docs_list()
            return
        super().do_GET()

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


def main():
    os.chdir(ROOT)
    server = http.server.ThreadingHTTPServer(("127.0.0.1", PORT), Handler)
    print(f"Typing app running at http://127.0.0.1:{PORT}/  (Ctrl+C to stop)")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
