"""Verify that the native browser fixture cannot target a real or foreign database."""
import unittest
from unittest.mock import patch
from types import SimpleNamespace
import subprocess
import json
from pathlib import Path
from urllib.parse import urlsplit
from run import PROJECTS, child_database_url, database_configuration, listener_started, scenario_titles, run_project


class NativeDatabaseTests(unittest.TestCase):
    def test_long_projects_run_every_discovered_case_with_independent_services_even_after_failure(self):
        report = {"suites": [{"specs": [{"title": "First", "tests": [1]}, {"title": "Second", "tests": [1]}]}]}
        for project in ("regression-mobile", "wishes-desktop", "privacy-mobile"):
            with self.subTest(project=project), patch("run.subprocess.run", return_value=SimpleNamespace(returncode=0, stdout=json.dumps(report))), patch("run.run", side_effect=[1, 0]) as execute:
                self.assertEqual(1, run_project(project, ()))
                self.assertEqual([(project, ("--grep", "First$")), (project, ("--grep", "Second$"))], [call.args for call in execute.call_args_list])

    def test_existing_small_projects_keep_their_grouped_service_isolation(self):
        with patch("run.run", return_value=0) as execute, patch("run.subprocess.run") as discover:
            self.assertEqual(0, run_project("push-mobile", ("--grep", "permission")))
            execute.assert_called_once_with("push-mobile", ("--grep", "permission"))
            discover.assert_not_called()

    def test_scenario_isolation_selects_every_nested_discovered_case_without_dropping_assertions(self):
        report = {"suites": [{"specs": [{"title": "First scenario", "tests": [{"projectName": "regression-mobile"}]}],
                              "suites": [{"specs": [{"title": "Second scenario", "tests": [{"projectName": "regression-mobile"}]}]}]}]}
        self.assertEqual(["First scenario", "Second scenario"], scenario_titles(report))

    def test_scenario_isolation_rejects_empty_duplicate_and_unselected_discovery(self):
        for report in ({}, {"suites": [{"specs": [{"title": "Empty", "tests": []}]}]},
                       {"suites": [{"specs": [{"title": "Duplicate", "tests": [1]}, {"title": "Duplicate", "tests": [1]}]}]}):
            with self.subTest(report=report), self.assertRaisesRegex(RuntimeError, "NATIVE_SCENARIO_DISCOVERY_INVALID"):
                scenario_titles(report)

    def test_push_projects_keep_their_fresh_services_alongside_the_new_regression_families(self):
        self.assertEqual(("mobile", "desktop", "admin-mobile", "admin-desktop", "push-mobile", "push-desktop", "regression-mobile", "regression-desktop",
                          "authentication-mobile", "authentication-desktop", "security-mobile", "security-desktop", "wishes-mobile", "wishes-desktop",
                          "collaboration-mobile", "collaboration-desktop", "privacy-mobile", "privacy-desktop", "moderation-mobile", "moderation-desktop",
                          "access-mobile", "access-desktop"), PROJECTS)

    def test_default_projects_and_catalog_select_real_playwright_scenarios(self):
        root = Path(__file__).resolve().parents[2]
        catalog = subprocess.run(
            ["node", "--input-type=module", "-e", "import {regressionCatalog} from './tools/regression/catalog.js'; console.log(JSON.stringify(regressionCatalog))"],
            cwd=root, capture_output=True, text=True, timeout=30, check=True,
        )
        entries = json.loads(catalog.stdout)
        for config, layer in (("playwright.config.js", "browser"), ("playwright.native.config.js", "native")):
            with self.subTest(config=config):
                result = subprocess.run(
                    ["node", str(root / "node_modules/@playwright/test/cli.js"), "test", "--config", config, "--list", "--reporter=json"],
                    cwd=root, capture_output=True, text=True, timeout=30, check=False,
                )
                self.assertEqual(0, result.returncode, result.stderr)
                report = json.loads(result.stdout)
                discovered = set()
                projects = set()

                def inspect(suites):
                    for suite in suites:
                        for spec in suite.get("specs", []):
                            self.assertTrue(spec["tests"], spec["title"])
                            discovered.add(Path(spec["file"]).name)
                            projects.update(test["projectName"] for test in spec["tests"])
                        inspect(suite.get("suites", []))

                inspect(report["suites"])
                if layer == "native":
                    self.assertEqual(set(PROJECTS), projects)
                    self.assertEqual(set(PROJECTS), {project["name"] for project in report["config"]["projects"]})
                for entry in entries:
                    for name in entry[layer]:
                        self.assertIn(name + ".spec.js", discovered, entry["name"])

    def test_waits_for_the_listener_event_in_current_and_older_native_logs(self):
        for event in ({"eventId": 901}, {"EventId": 901}):
            with self.subTest(event=event):
                self.assertTrue(listener_started(event))
        for event in ({"eventId": 905}, {"ended": True}, {}, []):
            with self.subTest(event=event):
                self.assertFalse(listener_started(event))

    def test_refuses_non_test_or_non_loopback_configuration(self):
        for value in ("", "postgres://user@localhost/monkado", "postgres://user@db.example/app_test",
                      "https://user@localhost/app_test", "postgres://localhost/app_test", "postgres://user@localhost/app_test#secret",
                      "postgres://user@localhost/app_test?host=production.example", "postgres://user@localhost/app_test?dbname=real"):
            with self.subTest(value=value), self.assertRaisesRegex(RuntimeError, "NATIVE_TEST_DATABASE_REQUIRED"):
                database_configuration(value)

    def test_creates_only_a_generated_child_and_preserves_the_parent(self):
        parsed, environment = database_configuration("postgres://test_user:test_only@127.0.0.1:55432/parent_test?sslmode=disable")
        name = "mk_front_" + "a" * 32 + "_test"
        self.assertEqual("parent_test", environment["PGDATABASE"])
        self.assertEqual("55432", environment["PGPORT"])
        self.assertEqual("/" + name, urlsplit(child_database_url(parsed, name)).path)
        for invalid in ("parent_test", "monkado", "mk_front_other_test", "../mk_front_" + "a" * 32 + "_test"):
            with self.subTest(name=invalid), self.assertRaisesRegex(RuntimeError, "NATIVE_DATABASE_NAME_INVALID"):
                child_database_url(parsed, invalid)
