"""CP-10: GatedCommit Happy Path (Stage -> Commit Gating).

Automates e2e/control-plane/02-Tests/manual_scripts/consistency/GatedCommitHappyPath.md.

Under ``ConsistencyMode=GatedCommit`` a flag toggle must be staged into every live DC's
Redis and only *then* committed (the committed pointer advances in both DCs together).
This scenario proves the commit converges and advances; it does not attempt to observe
the (inherently racy) pre-commit window deterministically -- see the skipped assertions.
"""

from core.scenario_base import ScenarioDefinition

from .consistency_base import ConsistencyScenarioBase


class CP10Scenario(ConsistencyScenarioBase):
    """CP-10 GatedCommit happy-path scenario."""

    FLAG_KEY = "ff-cp10-gatedcommit"

    def definition(self) -> ScenarioDefinition:
        return ScenarioDefinition(
            scenario_type="cp10",
            source_region="west",
            target_region="east",
            default_flag_key=self.FLAG_KEY,
            target_status=self.config.target_status,
        )

    def run(self) -> bool:
        try:
            self.setup_artifacts()
            definition = self.definition()
            headers = self.prepare(definition)

            source_url = self.get_api_base_url(definition.source_region)
            target_url = self.get_api_base_url(definition.target_region)
            contexts = [definition.source_region, definition.target_region]

            # Precondition: this scenario is only meaningful under GatedCommit.
            if not self.is_gated_commit():
                self.assertions.add_skip(
                    "consistency-mode",
                    f"ConsistencyMode={self.config.consistency_mode}; GatedCommit gating "
                    "assertions skipped. Run CP-14 for BestEffort coverage.",
                )
                return self.assertions.all_passed()

            # --- Phase 1: Baseline -------------------------------------------------
            flag_id = self.resolve_flag_id(source_url, self.FLAG_KEY, headers)
            if not flag_id:
                self.assertions.add_fail(
                    "flag-id-resolved",
                    f"Could not resolve GUID for flag '{self.FLAG_KEY}' via the API.",
                )
                return self.assertions.all_passed()
            self.assertions.add_pass("flag-id-resolved", f"flag_id={flag_id}.")

            baseline = {c: self.get_committed_pointer(c, "flag", flag_id) for c in contexts}
            self.add_timeline_event(
                "phase-start", phase="phase-1-baseline", result={"committed": baseline}
            )
            baseline_ts = baseline.get(definition.source_region)

            # --- Phase 2/3: Toggle, then observe commit + convergence --------------
            self.add_timeline_event("phase-start", phase="phase-2-toggle")
            toggle_result = self.toggle_flag(source_url, self.FLAG_KEY, True, headers)
            self.add_timeline_event("api-toggle", phase="phase-2", result=toggle_result)
            self.assertions.add_pass("api-toggle-succeeded", "Toggle to true accepted by source.")

            # A new commit must advance the pointer in BOTH DCs to the SAME new ts.
            converged, observed = self.poll_committed_convergence(
                "flag", flag_id, contexts, not_equal_to=baseline_ts
            )
            self.assertions.add(
                "committed-pointer-converged",
                converged,
                f"Committed pointer advanced and matches across {contexts}: {observed} "
                f"(baseline source ts={baseline_ts}).",
                "evaluated",
            )

            # Staging is a precondition of commit: the versioned snapshot must exist.
            for ctx in contexts:
                staged = self.staged_versions(ctx, "flag", flag_id)
                self.assertions.add(
                    f"staged-version-present-{ctx}",
                    len(staged) > 0,
                    f"Staged version key(s) present in {ctx}: {staged[:3]}.",
                    "evaluated",
                )

            # The committed value must be visible via the management API in both DCs.
            api_converged, _src, _tgt = self.poll_convergence(
                source_url, target_url, self.FLAG_KEY, True, headers
            )
            self.assertions.add(
                "api-state-converged",
                api_converged,
                "Both regions report isEnabled=true after commit.",
                "evaluated",
            )

            # Optional: consistency metrics (commits incremented).
            self.run_named_command(
                "metrics-commits",
                self.config.consistency_metrics_check_command,
                required=False,
            )

            # --- Phase 4: Reverse toggle ------------------------------------------
            self.add_timeline_event("phase-start", phase="phase-4-reverse")
            committed_after_true = observed.get(definition.source_region)
            self.toggle_flag(source_url, self.FLAG_KEY, False, headers)
            reverse_converged, reverse_observed = self.poll_committed_convergence(
                "flag", flag_id, contexts, not_equal_to=committed_after_true
            )
            self.assertions.add(
                "reverse-committed-converged",
                reverse_converged,
                f"Committed pointer advanced again on reverse toggle: {reverse_observed}.",
                "evaluated",
            )

            # Negative observation that cannot be made deterministic from outside.
            self.assertions.add_skip(
                "no-serve-before-commit",
                "Observing the staged-but-uncommitted window (and the withheld downstream "
                "publish) is racy at the default coordinator interval; verify manually or "
                "via CP-11 which holds the pending state open. See manual script notes.",
            )

            # --- Post-condition: leave the flag committed-false -------------------
            self._notify_step("cleanup", "running")
            self.toggle_flag(source_url, self.FLAG_KEY, False, headers)
            self.add_timeline_event("cleanup", phase="reset-flag-to-false")
            self._notify_step("cleanup", "ok")

            return self.assertions.all_passed()

        except Exception as exc:  # noqa: BLE001
            self.assertions.add_fail("runner-execution", str(exc))
            return False
        finally:
            self.write_artifacts()
