"""No failed, cancelled or skipped matrix can authorize production publication."""

import os
from pathlib import Path
import subprocess
import shutil
import unittest


class QualityGateTests(unittest.TestCase):
    def test_gate_requires_success_from_quality_contract_every_browser_shard_and_native_journeys(self):
        workflow = (Path(__file__).resolve().parents[2] / ".github/workflows/quality.yml").read_text()
        gate = workflow.split("      - name: Require every check\n", 1)[1]
        command = gate.split("        run: ", 1)[1].strip()
        successful = dict(QUALITY_RESULT="success", CONTRACT_RESULT="success", BROWSER_RESULT="success", NATIVE_BROWSER_RESULT="success")
        bash = shutil.which("bash")
        self.assertIsNotNone(bash)
        result = subprocess.run([bash, "-c", command], env=dict(os.environ, **successful), check=False)
        self.assertEqual(0, result.returncode)
        for dependency in successful:
            for status in ("failure", "cancelled", "skipped"):
                with self.subTest(dependency=dependency, status=status):
                    result = subprocess.run([bash, "-c", command], env=dict(os.environ, **(successful | {dependency: status})), check=False)
                    self.assertNotEqual(0, result.returncode)


if __name__ == "__main__":
    unittest.main()
