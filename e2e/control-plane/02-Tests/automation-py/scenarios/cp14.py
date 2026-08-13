"""CP-14: ConsistencyMode Toggle and Rollback (GatedCommit <-> BestEffort).

Automates e2e/control-plane/02-Tests/manual_scripts/consistency/ConsistencyModeToggle.md.

Validates that ConsistencyMode is a safe, reversible switch:
  * BestEffort  -> immediate propagation via the legacy ``featbit:flag:{id}`` key, no
    committed pointer.
  * GatedCommit -> stage -> commit lifecycle (committed pointer advances).
  * rollback to BestEffort -> immediate propagation resumes; leftover staged keys are
    harmless and GC'd.

Mode flips require redeploy/restart, so they are driven by configured commands
(``set_besteffort_command`` / ``set_gatedcommit_command``). When those are absent the
mode-flip phases are skipped and only the *current* mode's shape is asserted. The DcId
mismatch negative (Phase 4) is not automated (requires a mis-set config + restart +
metric scrape) and is recorded as a skip.
"""

import time

from core.scenario_base import ScenarioDefinition

from .consistency_base import ConsistencyScenarioBase


class CP14Scenario(ConsistencyScenarioBase):
    """CP-14 ConsistencyMode toggle/rollback scenario."""

    FLAG_KEY = "ff-cp14-mode"

    def definition(self) -> ScenarioDefinition:
        return ScenarioDefinition(
            scenario_type="cp14",
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

            flag_id = self.resolve_flag_id(source_url, self.FLAG_KEY, headers)
            if not flag_id:
                self.assertions.add_fail(
                    "flag-id-resolved", f"Could not resolve GUID for '{self.FLAG_KEY}'."
                )
                return self.assertions.all_passed()
            self.assertions.add_pass("flag-id-resolved", f"flag_id={flag_id}.")

            can_flip = bool(
                self.config.set_besteffort_command and self.config.set_gatedcommit_command
            )

            # --- Phase 1: current-mode shape ---------------------------------------
            self.add_timeline_event("phase-start", phase="phase-1-besteffort")
            if self._phase1_asserts_besteffort(can_flip, self.config.consistency_mode):
                if self.config.set_besteffort_command:
                    self.run_named_command(
                        "set-besteffort",
                        self.config.set_besteffort_command,
                        required=False,
                        timeout=600,
                    )
                    time.sleep(self.config.commit_coordinator_interval_seconds)
                self._assert_besteffort_shape(
                    source_url, target_url, contexts, flag_id, headers, label="phase-1"
                )
            else:
                # GatedCommit cluster with no flip commands: a BestEffort-shape
                # assertion would false-fail (the committed pointer advances on
                # every toggle), so assert the current GatedCommit shape instead.
                self.assertions.add_skip(
                    "phase-1-besteffort-shape",
                    f"Cluster runs {self.config.consistency_mode} and no mode-flip "
                    "commands are configured; asserted the GatedCommit shape instead.",
                )
                self._assert_gatedcommit_shape(
                    source_url,
                    contexts,
                    flag_id,
                    headers,
                    definition,
                    name="phase-1-gatedcommit-pointer-advances",
                    target_state=True,
                )

            if not can_flip:
                self.assertions.add_skip(
                    "mode-flip",
                    "set_besteffort_command/set_gatedcommit_command not configured; only the "
                    f"current mode ({self.config.consistency_mode}) shape was asserted. Provide "
                    "the mode-flip commands to cover enable + rollback.",
                )
            else:
                # --- Phase 2: Enable GatedCommit ----------------------------------
                self.add_timeline_event("phase-start", phase="phase-2-gatedcommit")
                self.run_named_command(
                    "set-gatedcommit",
                    self.config.set_gatedcommit_command,
                    required=True,
                    timeout=600,
                )
                time.sleep(self.config.commit_coordinator_interval_seconds)
                # Optional DcId-mismatch advisory smoke (clean expected).
                self.run_named_command(
                    "metrics-unmatched-dc",
                    self.config.consistency_metrics_check_command,
                    required=False,
                )
                self._assert_gatedcommit_shape(
                    source_url,
                    contexts,
                    flag_id,
                    headers,
                    definition,
                    name="gatedcommit-pointer-advances",
                    target_state=False,
                )

                # --- Phase 3: Rollback to BestEffort ------------------------------
                self.add_timeline_event("phase-start", phase="phase-3-rollback")
                self.run_named_command(
                    "set-besteffort-rollback",
                    self.config.set_besteffort_command,
                    required=True,
                    timeout=600,
                )
                time.sleep(self.config.commit_coordinator_interval_seconds)
                self._assert_besteffort_shape(
                    source_url, target_url, contexts, flag_id, headers, label="phase-3"
                )

            # --- Phase 4: DcId mismatch negative (not automated) ------------------
            self.assertions.add_skip(
                "dcid-mismatch-advisory",
                "Negative DcId-mismatch test requires deliberately mis-setting an eval-server "
                "ControlPlane:DcId + restart + scraping unmatched_dc_count; not automated. "
                "See operator guide section 2.3.",
            )

            # Post-condition: reset flag to false.
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

    def _assert_besteffort_shape(
        self, source_url, target_url, contexts, flag_id, headers, *, label
    ) -> None:
        """Toggle and assert BestEffort propagation: legacy key updates, pointer untouched.

        Note: committed-pointer keys legitimately PERSIST after a GatedCommit->BestEffort
        rollback (they are harmless residue; see the ops guide's rollback section) — so the
        correct BestEffort assertion is that the pointer does not ADVANCE during the toggle,
        not that it is absent.
        """
        pointers_before = {c: self.get_committed_pointer(c, "flag", flag_id) for c in contexts}
        self.toggle_flag(source_url, self.FLAG_KEY, True, headers)
        # Immediate propagation: the management API converges to true.
        api_converged, _src, _tgt = self.poll_convergence(
            source_url, target_url, self.FLAG_KEY, True, headers
        )
        self.assertions.add(
            f"{label}-besteffort-immediate-propagation",
            api_converged,
            "Both regions report isEnabled=true (immediate best-effort propagation).",
            "evaluated",
        )
        # The committed pointer must not ADVANCE under BestEffort (stale residue from a
        # previous GatedCommit phase is expected and harmless).
        pointers_after = {c: self.get_committed_pointer(c, "flag", flag_id) for c in contexts}
        self.assertions.add(
            f"{label}-besteffort-pointer-not-advanced",
            pointers_after == pointers_before,
            f"Committed pointer unchanged by a BestEffort toggle "
            f"(before {pointers_before}, after {pointers_after}).",
            "evaluated",
        )
        # The legacy single-value key should be present in both DCs.
        legacy = {c: self.get_legacy_value(c, "flag", flag_id) for c in contexts}
        self.assertions.add(
            f"{label}-besteffort-legacy-key-present",
            all(v is not None for v in legacy.values()),
            f"Legacy featbit:flag:{{id}} key present in both DCs (observed keys: "
            f"{ {c: (v is not None) for c, v in legacy.items()} }).",
            "evaluated",
        )

    @staticmethod
    def _phase1_asserts_besteffort(can_flip: bool, consistency_mode) -> bool:
        """Phase 1 may only assert the BestEffort shape when we can flip into
        it (mode-flip commands configured) or the cluster already runs
        BestEffort. Otherwise the committed pointer advances on every toggle
        and the BestEffort assertions false-fail (#113)."""
        return can_flip or (consistency_mode or "").strip().lower() == "besteffort"

    def _assert_gatedcommit_shape(
        self, source_url, contexts, flag_id, headers, definition, *, name, target_state
    ) -> None:
        """Toggle and assert GatedCommit propagation: committed pointer advances."""
        baseline = {c: self.get_committed_pointer(c, "flag", flag_id) for c in contexts}
        self.toggle_flag(source_url, self.FLAG_KEY, target_state, headers)
        converged, observed = self.poll_committed_convergence(
            "flag", flag_id, contexts, not_equal_to=baseline.get(definition.source_region)
        )
        self.assertions.add(
            name,
            converged,
            f"Under GatedCommit the committed pointer advanced/converged: {observed}.",
            "evaluated",
        )
