"""Run browser journeys against disposable native services, without production credentials."""

import json
import os
from pathlib import Path
import queue
import re
import subprocess
import sys
import tempfile
import threading
from urllib.parse import unquote, urlsplit, urlunsplit
import uuid
import base64
import argparse
import hashlib


ROOT = Path(__file__).resolve().parents[2]
PROJECTS = ("mobile", "desktop", "admin-mobile", "admin-desktop", "push-mobile", "push-desktop", "regression-mobile", "regression-desktop")
PROJECTS += tuple(f"{area}-{viewport}" for area in ("authentication", "security", "wishes", "collaboration", "privacy", "moderation", "access") for viewport in ("mobile", "desktop"))


def database_configuration(value):
    """Accept only an explicitly configured loopback test database as the creation parent."""
    try:
        parsed = urlsplit(value)
        if (parsed.scheme not in ("postgres", "postgresql") or parsed.hostname not in ("localhost", "127.0.0.1", "::1")
                or not re.fullmatch(r"/[a-zA-Z0-9_]+_test", parsed.path) or not parsed.username or parsed.fragment
                or parsed.query not in ("", "sslmode=disable")):
            raise ValueError()
        port = str(parsed.port or 5432)
    except (ValueError, TypeError):
        raise RuntimeError("NATIVE_TEST_DATABASE_REQUIRED") from None
    environment = {"PGHOST": parsed.hostname, "PGPORT": port, "PGUSER": unquote(parsed.username),
                   "PGPASSWORD": unquote(parsed.password or ""), "PGDATABASE": parsed.path[1:]}
    return parsed, environment


def child_database_url(parsed, name):
    """Never create or remove a caller-selected database."""
    if not re.fullmatch(r"mk_front_[0-9a-f]{32}_test", name):
        raise RuntimeError("NATIVE_DATABASE_NAME_INVALID")
    return urlunsplit((parsed.scheme, parsed.netloc, "/" + name, parsed.query, ""))


def listener_started(event):
    """Recognize the listener event in both supported structured-log formats."""
    return isinstance(event, dict) and event.get("eventId", event.get("EventId")) == 901


def scenario_titles(report):
    """Select every discovered scenario exactly once before isolating its real quotas."""
    titles = []

    def visit(suites):
        for suite in suites:
            for spec in suite.get("specs", []):
                if not spec.get("tests") or not isinstance(spec.get("title"), str):
                    raise RuntimeError("NATIVE_SCENARIO_DISCOVERY_INVALID")
                titles.append(spec["title"])
            visit(suite.get("suites", []))

    visit(report.get("suites", []))
    if not titles or len(titles) != len(set(titles)):
        raise RuntimeError("NATIVE_SCENARIO_DISCOVERY_INVALID")
    return titles


def run_project(project, arguments):
    """Long cross-feature scenarios each own fresh services, retaining production request limits."""
    if not project.startswith(("regression-", "wishes-", "privacy-")):
        return run(project, arguments)
    node = os.environ.get("NODE", "node")
    listed = subprocess.run([node, str(ROOT / "node_modules/@playwright/test/cli.js"), "test", "--config", "playwright.native.config.js",
                             "--project=" + project, *arguments, "--list", "--reporter=json"], cwd=ROOT, capture_output=True, text=True, encoding="utf-8", timeout=30)
    if listed.returncode:
        raise RuntimeError("NATIVE_SCENARIO_DISCOVERY_FAILED")
    titles = scenario_titles(json.loads(listed.stdout))
    results = [run(project, (*arguments, "--grep", re.escape(title) + "$")) for title in titles]
    return 1 if any(results) else 0


def run(project, arguments=()):
    """Own the database and processes for exactly one Playwright invocation."""
    parsed, pg = database_configuration(os.environ.get("MONKADO_TEST_DATABASE_URL", ""))
    backend = Path(os.environ.get("MONKADO_BACKEND_SOURCE", str(ROOT.parent / "mon-kado"))).resolve()
    if not (backend / "cmd/api/main.go").is_file():
        raise RuntimeError("NATIVE_BACKEND_SOURCE_REQUIRED")
    workspace = ROOT / ".local/native-e2e"
    workspace.mkdir(parents=True, exist_ok=True)
    directory = Path(tempfile.mkdtemp(prefix="run-", dir=workspace))
    for name in ("images", "exports", "mailbox"):
        (directory / name).mkdir()
    database = "mk_front_" + uuid.uuid4().hex + "_test"
    database_url = child_database_url(parsed, database)
    environment = {key: value for key, value in os.environ.items() if not key.upper().startswith("PG")} | pg
    processes, readers = [], []
    created = False
    suffix = ".exe" if os.name == "nt" else ""

    def command(arguments, step, cwd=backend, env=environment):
        result = subprocess.run(arguments, cwd=cwd, env=env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=240)
        with (directory / "setup.log").open("ab") as log:
            log.write(result.stdout)
        if result.returncode:
            raise RuntimeError(step)

    def start(component, service_environment):
        process = subprocess.Popen([str(directory / (component + suffix))], cwd=directory, env=service_environment,
                                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, encoding="utf-8")
        processes.append(process)
        events = queue.Queue()

        def collect():
            with (directory / (component + ".log")).open("w", encoding="utf-8") as log:
                for line in process.stdout:
                    log.write(line)
                    try:
                        events.put(json.loads(line))
                    except ValueError:
                        pass
            events.put({"ended": True})

        reader = threading.Thread(target=collect)
        reader.start()
        readers.append(reader)
        return events

    try:
        command(["createdb", "--maintenance-db=" + pg["PGDATABASE"], database], "NATIVE_DATABASE_CREATION_FAILED")
        created = True
        for component in ("api", "worker", "migrate"):
            command(["go", "build", "-o", str(directory / (component + suffix)), "./cmd/" + component], "NATIVE_BUILD_FAILED")
        # Only process necessities and disposable settings reach the application.
        service_environment = {key: value for key, value in os.environ.items()
                               if key.upper() in {"PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "HOME", "LANG"}}
        service_environment |= {"APP_ENV": "local", "DATABASE_URL": database_url,
                                "JWT_SIGNING_KEY": base64.b64encode(os.urandom(32)).decode(),
                                "DATA_ENCRYPTION_KEY": base64.b64encode(os.urandom(32)).decode(),
                                "HTTP_ADDRESS": "127.0.0.1:7006", "PUBLIC_API_ORIGIN": "http://localhost:7006",
                                "FRONTEND_ORIGIN": "http://localhost:5296", "ALLOWED_ORIGINS": "http://localhost:5296",
                                "ALLOWED_HOSTS": "localhost,127.0.0.1", "GOOGLE_ENABLED": "false",
                                "EMAIL_PROVIDER": "Mailbox", "WORKER_INTERVAL": "1s",
                                "IMAGE_PATH": str(directory / "images"), "EXPORT_PATH": str(directory / "exports"),
                                "MAILBOX_PATH": str(directory / "mailbox")}
        # Public test key D=1; no provider credentials or outbound push are used in this quality gate.
        service_environment |= {"PUSH_ENABLED": "true", "PUSH_VAPID_PRIVATE_KEY": base64.urlsafe_b64encode(bytes(31) + bytes([1])).decode().rstrip("="),
                                "PUSH_VAPID_PUBLIC_KEY": base64.urlsafe_b64encode(bytes.fromhex("04" + "6b17d1f2e12c4247f8bce6e563a440f277037d812deb33a0f4a13945d898c296" + "4fe342e2fe1a7f9b8ee7eb4a7c0f9e162bce33576b315ececbb6406837bf51f5")).decode().rstrip("="),
                                "PUSH_VAPID_SUBJECT": "https://example.test"}
        command([str(directory / ("migrate" + suffix))], "NATIVE_MIGRATION_FAILED", cwd=directory, env=service_environment)
        events = start("api", service_environment)
        while True:
            event = events.get(timeout=30)
            if event.get("ended"):
                raise RuntimeError("NATIVE_API_STOPPED")
            if listener_started(event):
                break
        start("worker", service_environment | {"PUSH_ENABLED": "false"})
        metadata = directory / "fixture.json"
        metadata.write_text(json.dumps({"mailbox": str(directory / "mailbox"), "database": database}), encoding="utf-8")
        browser_environment = os.environ.copy() | {"MONKADO_NATIVE_FIXTURE": str(metadata), "MONKADO_NATIVE_PROJECT": project}
        if "--grep" in arguments:
            browser_environment["MONKADO_NATIVE_CASE"] = hashlib.sha256("\0".join(arguments).encode()).hexdigest()[:12]
        node = os.environ.get("NODE", "node")
        result = subprocess.run([node, str(ROOT / "node_modules/@playwright/test/cli.js"), "test",
                                 "--config", "playwright.native.config.js", "--project=" + project, *arguments], cwd=ROOT, env=browser_environment)
        return result.returncode
    finally:
        for process in reversed(processes):
            if process.poll() is None:
                process.terminate()
            try:
                process.wait(timeout=15)
            except subprocess.TimeoutExpired:
                process.kill()
                process.wait(timeout=5)
        for reader in readers:
            reader.join(timeout=5)
        for process in processes:
            process.stdout.close()
        if created:
            child_database_url(parsed, database)
            command(["dropdb", "--maintenance-db=" + pg["PGDATABASE"], database], "NATIVE_DATABASE_CLEANUP_FAILED")


if __name__ == "__main__":
    try:
        parser = argparse.ArgumentParser(description=__doc__)
        parser.add_argument("--project", choices=PROJECTS)
        options, arguments = parser.parse_known_args()
        # Each viewport owns fresh services and data, including the real admission quotas.
        results = [run_project(project, arguments) for project in ([options.project] if options.project else PROJECTS)]
        sys.exit(1 if any(results) else 0)
    except Exception as error:
        print(str(error) if type(error) is RuntimeError else "NATIVE_JOURNEYS_FAILED", file=sys.stderr)
        sys.exit(1)
