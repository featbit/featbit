"""Bootstrap runner for CP-09 — sets sys.path then invokes the CLI."""
import sys
import os

# Ensure the automation-py directory is on sys.path
_ROOT = os.path.dirname(os.path.abspath(__file__))
if _ROOT not in sys.path:
    sys.path.insert(0, _ROOT)
os.chdir(_ROOT)

from cli.main import cli  # noqa: E402

if __name__ == "__main__":
    cli(
        [
            "suite",
            "cp09",
            "--env-id",
            "69310513-2c85-46e4-94bf-9247981e3565",
            "--no-dashboard",
        ],
        standalone_mode=True,
    )
