"""CP-14 phase 1 must only assert the BestEffort shape when it can actually
be in BestEffort — i.e. flip commands exist or the cluster runs BestEffort (#113)."""

import pytest

from scenarios.cp14 import CP14Scenario


@pytest.mark.parametrize(
    ("can_flip", "mode", "expected"),
    [
        (False, "GatedCommit", False),   # the #113 false-fail case
        (False, "BestEffort", True),
        (False, "besteffort", True),     # case-insensitive
        (False, " BestEffort ", True),   # tolerant of whitespace
        (True, "GatedCommit", True),     # flip commands present -> phase 1 flips first
        (True, "BestEffort", True),
        (False, "", False),              # unknown -> default GatedCommit posture
        (False, None, False),
    ],
)
def test_phase1_asserts_besteffort(can_flip, mode, expected):
    assert CP14Scenario._phase1_asserts_besteffort(can_flip, mode) is expected
