"""Basic smoke tests for typing-web server and static assets."""
import json
import os
import subprocess
import sys
import time
import urllib.error
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
PORT = 8765
BASE = f"http://127.0.0.1:{PORT}"


def fetch(path):
    with urllib.request.urlopen(BASE + path, timeout=5) as resp:
        return resp.status, resp.read()


def wait_server(timeout=8):
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            status, _ = fetch("/")
            if status == 200:
                return True
        except (urllib.error.URLError, ConnectionResetError):
            time.sleep(0.2)
    return False


def test_api_docs():
    status, body = fetch("/api/docs")
    assert status == 200
    docs = json.loads(body.decode("utf-8"))
    assert isinstance(docs, list)
    assert len(docs) > 0
    assert all(name.endswith((".txt", ".md")) for name in docs)


def test_static_files():
    for path in ("/", "/app.js", "/style.css", "/index.html"):
        status, body = fetch(path)
        assert status == 200
        assert len(body) > 0


def test_doc_content():
    status, body = fetch("/api/docs")
    docs = json.loads(body.decode("utf-8"))
    name = docs[0]
    status2, text = fetch("/docs/" + name)
    assert status2 == 200
    assert len(text.decode("utf-8").strip()) > 0


def test_app_js_contains_features():
    _, body = fetch("/app.js")
    src = body.decode("utf-8")
    for needle in ("speedUnit", "preventDefault", "MAX_HISTORY", "exportHistoryBtn"):
        assert needle in src, f"missing {needle} in app.js"


def test_categories_json():
    status, body = fetch("/docs/categories.json")
    assert status == 200
    data = json.loads(body.decode("utf-8"))
    assert "prefixes" in data
    assert len(data["prefixes"]) > 0


def test_vendor_chart():
    status, body = fetch("/vendor/chart.umd.min.js")
    assert status == 200
    assert len(body) > 100000


def test_path_traversal_blocked():
    import urllib.error
    for bad_path in ("/docs/../server.py", "/docs/%2e%2e/server.py", "/docs/..%2fserver.py"):
        try:
            fetch(bad_path)
            raise AssertionError(f"Path traversal not blocked: {bad_path}")
        except urllib.error.HTTPError as e:
            assert e.code == 403, f"Expected 403 for {bad_path}, got {e.code}"


def main():
    proc = subprocess.Popen(
        [sys.executable, "server.py", "--port", str(PORT)],
        cwd=ROOT,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    try:
        if not wait_server():
            raise RuntimeError("server did not start")
        test_api_docs()
        test_static_files()
        test_doc_content()
        test_app_js_contains_features()
        test_categories_json()
        test_vendor_chart()
        test_path_traversal_blocked()
        print("All tests passed.")
        return 0
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=3)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    raise SystemExit(main())
