"""Assertion tracking and evaluation."""

from dataclasses import dataclass, field
from typing import List

from .models import AssertionResult


@dataclass
class AssertionRegistry:
    """Registry for tracking assertions during scenario execution."""

    assertions: List[AssertionResult] = field(default_factory=list)

    def add(
        self,
        name: str,
        passed: bool,
        details: str = "",
        status: str = "evaluated",
    ) -> None:
        """Add an assertion result.

        Args:
            name: Assertion name
            passed: Whether assertion passed
            details: Details about assertion result
            status: Status (evaluated, skipped)
        """
        self.assertions.append(
            AssertionResult(name=name, passed=passed, details=details, status=status)
        )

    def add_pass(self, name: str, details: str = "") -> None:
        """Record passed assertion."""
        self.add(name, True, details, "evaluated")

    def add_fail(self, name: str, details: str = "") -> None:
        """Record failed assertion."""
        self.add(name, False, details, "evaluated")

    def add_skip(self, name: str, details: str = "Not configured.") -> None:
        """Record skipped assertion."""
        self.add(name, True, details, "skipped")

    def all_passed(self) -> bool:
        """Check if all evaluated assertions passed."""
        evaluated = [a for a in self.assertions if a.status == "evaluated"]
        return all(a.passed for a in evaluated) if evaluated else True

    def get_failed(self) -> List[AssertionResult]:
        """Get all failed assertions."""
        return [a for a in self.assertions if a.status == "evaluated" and not a.passed]

    def get_passed_count(self) -> int:
        """Get count of passed (evaluated) assertions."""
        return sum(1 for a in self.assertions if a.status == "evaluated" and a.passed)

    def get_failed_count(self) -> int:
        """Get count of failed assertions."""
        return len(self.get_failed())

    def get_skipped_count(self) -> int:
        """Get count of skipped assertions."""
        return sum(1 for a in self.assertions if a.status == "skipped")
