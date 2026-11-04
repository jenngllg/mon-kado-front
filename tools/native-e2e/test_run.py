"""Verify that the native browser fixture cannot target a real or foreign database."""
import unittest
from urllib.parse import urlsplit
from run import PROJECTS, child_database_url, database_configuration, listener_started


class NativeDatabaseTests(unittest.TestCase):
    def test_push_projects_have_their_own_fresh_services_and_production_admission_budgets(self):
        self.assertEqual(("mobile", "desktop", "admin-mobile", "admin-desktop", "push-mobile", "push-desktop"), PROJECTS)

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
