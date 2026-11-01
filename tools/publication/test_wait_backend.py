"""Exercise the actual publication shell step with deterministic GitHub responses."""

import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import textwrap
import unittest

WORKFLOW = Path(__file__).resolve().parents[2] / ".github/workflows/stage-coordinated-frontend.yml"


class BackendPublicationWaitTests(unittest.TestCase):
    def test_published_revision_wait_timeout_and_changed_main(self):
        step = WORKFLOW.read_text().split("      - name: Resolve the explicitly published backend\n", 1)[1]
        script = textwrap.dedent(step.split("        run: |\n", 1)[1].split("      - uses:", 1)[0])
        for scenario, success, code, calls, checks in (("ready", True, "", 1, 0), ("pending", True, "", 2, 2),
                                                      ("timeout", False, "BACKEND_PUBLICATION_TIMEOUT", 1, 2),
                                                      ("changed", False, "BACKEND_MAIN_CHANGED", 0, 0),
                                                      ("provider-error", False, "", 1, 0),
                                                      ("failed-ci", False, "BACKEND_CHECKS_FAILED", 1, 1),
                                                      ("cancelled-ci", False, "BACKEND_CHECKS_FAILED", 1, 1)):
            with self.subTest(scenario=scenario), tempfile.TemporaryDirectory() as temporary:
                root = Path(temporary)
                gh = root / "gh"
                gh.write_text("#!" + sys.executable + "\n" + textwrap.dedent('''\
                    import json, os, pathlib, sys
                    path = pathlib.Path(os.environ['RUNNER_TEMP']) / 'calls.json'
                    state = json.loads(path.read_text()) if path.exists() else {'main': 0, 'release': 0, 'checks': 0}
                    main = sys.argv[2].endswith('/git/ref/heads/main')
                    checks = '/actions/workflows/' in sys.argv[2]
                    key = 'main' if main else 'checks' if checks else 'release'
                    state[key] += 1
                    path.write_text(json.dumps(state))
                    scenario = os.environ['WAIT_SCENARIO']
                    if checks:
                        print('failure' if scenario == 'failed-ci' else 'cancelled' if scenario == 'cancelled-ci' else 'null')
                    elif main:
                        print(('b' if scenario == 'changed' and state['main'] > 1 else 'a') * 40)
                    elif scenario == 'provider-error':
                        sys.exit(1)
                    else:
                        ready = scenario == 'ready' or scenario == 'pending' and state['release'] > 1
                        print(json.dumps({'body': json.dumps({'revision': ('a' if ready else 'b') * 40})}))
                    '''))
                gh.chmod(0o755)
                sleep = root / "sleep"
                sleep.write_text("#!/bin/sh\nexit 0\n")
                sleep.chmod(0o755)
                output = root / "output"
                result = subprocess.run(["bash", "-c", script], capture_output=True, text=True, timeout=5,
                                        env=dict(os.environ, PATH=str(root) + os.pathsep + os.environ['PATH'],
                                                 RUNNER_TEMP=str(root), GITHUB_OUTPUT=str(output), WAIT_SCENARIO=scenario,
                                                 BACKEND_PUBLICATION_WAIT_SECONDS="0" if scenario == "timeout" else "600"))
                self.assertEqual(success, result.returncode == 0, result.stderr)
                self.assertEqual(calls, json.loads((root / "calls.json").read_text())['release'])
                self.assertEqual(checks, json.loads((root / "calls.json").read_text())['checks'])
                if success:
                    self.assertEqual("revision=" + "a" * 40 + "\n", output.read_text())
                else:
                    self.assertFalse(output.exists())
                    self.assertIn(code, result.stdout)


if __name__ == "__main__":
    unittest.main()
