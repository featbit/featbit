"""CP-12: GatedCommit Recovery Backfill (cross-DC partition).

Automates e2e/control-plane/02-Tests/manual_scripts/consistency/GatedCommitRecovery.md.

Uses a single cross-DC network partition (chaos-mesh NetworkChaos on both clusters) to
take the target DC out: while partitioned it misses commits (its Redis goes stale) and
is evicted, so the survivor commits alone. Healing the partition makes the target
"return", and the recovery worker backfills its Redis with the current committed flag
(and segment) state. The segment-membership edit is out of scope (skipped); segment
pointer backfill is checked when a segment id is available.
"""

import time

from core.scenario_base import ScenarioDefinition

from .consistency_base import ConsistencyScenarioBase


class CP12Scenario(ConsistencyScenarioBase):
    """CP-12 GatedCommit recovery scenario."""

    FLAG_KEY = "ff-cp12-recovery"
    SEGMENT_KEY = "seg-cp12-recovery"

    def definition(self) -> ScenarioDefinition:
        # Source = west (survivor), target = east (partitioned, then recovered).
        return ScenarioDefinition(
            scenario_type="cp12",
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
            source_ctx = definition.source_region
            target_ctx = definition.target_region

            if not self.is_gated_commit():
                self.assertions.add_skip(
                    "consistency-mode",
                    f"ConsistencyMode={self.config.consistency_mode}; recovery backfill only "
                    "applies under GatedCommit.",
                )
                return self.assertions.all_passed()

            if not self.config.partition_start_command:
                self.assertions.add_skip(
                    "partition-configured",
                    "No partition_start_command configured; cannot sever the cross-DC link "
                    "to take the target DC out and exercise recovery backfill.",
                )
                return self.assertions.all_passed()

            flag_id = self.resolve_flag_id(source_url, self.FLAG_KEY, headers)
            if not flag_id:
                self.assertions.add_fail(
                    "flag-id-resolved", f"Could not resolve GUID for '{self.FLAG_KEY}'."
                )
                return self.assertions.all_passed()
            self.assertions.add_pass("flag-id-resolved", f"flag_id={flag_id}.")

            partitioned = False
            src_ts = None
            try:
                # --- Phase 1: Partition the target out ----------------------------
                self.add_timeline_event("phase-start", phase="phase-1-partition")
                baseline_src = self.get_committed_pointer(source_ctx, "flag", flag_id)
                self.run_named_command(
                    "partition-start", self.config.partition_start_command, required=True
                )
                partitioned = True
                time.sleep(self.config.commit_coordinator_interval_seconds)

                # --- Phase 2: Commit on the survivor while the target is absent ----
                self.add_timeline_event("phase-start", phase="phase-2-change-while-absent")
                self.toggle_flag(source_url, self.FLAG_KEY, True, headers)
                # A committed pointer already exists, so wait for it to ADVANCE past the
                # baseline (the survivor commits once the target's lease expires).
                evict_timeout = (
                    self.config.lease_ttl_seconds
                    + self.config.commit_coordinator_interval_seconds
                    + self.config.timeout_seconds
                )
                committed_src, src_ts = self.poll_committed_pointer(
                    source_ctx, "flag", flag_id, advanced_from=baseline_src, timeout=evict_timeout
                )
                self.assertions.add(
                    "committed-on-source-while-absent",
                    bool(committed_src),
                    f"Survivor {source_ctx} committed to {src_ts} while the target was "
                    f"partitioned/evicted (baseline {baseline_src}).",
                    "evaluated",
                )

                # The partitioned target must be stale (missed the commit).
                target_before = self.get_committed_pointer(target_ctx, "flag", flag_id)
                self.assertions.add(
                    "target-stale-before-recovery",
                    target_before != src_ts,
                    f"Partitioned target {target_ctx} pointer ({target_before}) is stale vs "
                    f"survivor ({src_ts}) before recovery.",
                    "evaluated",
                )

                # --- Phase 3: Heal -> recovery worker backfills the target --------
                self.add_timeline_event("phase-start", phase="phase-3-recover")
                self.run_named_command(
                    "partition-stop", self.config.partition_stop_command, required=True
                )
                partitioned = False
            finally:
                if partitioned:
                    self.run_named_command(
                        "partition-stop-cleanup",
                        self.config.partition_stop_command,
                        required=False,
                    )

            recovery_timeout = (
                self.config.recovery_interval_seconds * 3 + self.config.timeout_seconds
            )
            # After heal the pointer may re-commit/advance again, so assert the target
            # CONVERGES with the survivor (both equal, non-null) and has moved off its
            # stale value — rather than matching the exact ts captured during the partition.
            converged, observed = self.poll_committed_convergence(
                "flag", flag_id, [source_ctx, target_ctx], timeout=recovery_timeout
            )
            observed_ts = observed.get(target_ctx)
            self.assertions.add(
                "flag-backfilled-on-recovery",
                converged and observed_ts != target_before,
                f"Target {target_ctx} committed pointer backfilled to {observed_ts} and "
                f"converged with survivor {observed.get(source_ctx)} after recovery "
                f"(was stale at {target_before}).",
                "evaluated",
            )
            staged = self.staged_versions(target_ctx, "flag", flag_id)
            self.assertions.add(
                "flag-version-present-after-recovery",
                len(staged) > 0,
                f"Recovered target holds the committed version snapshot: {staged[:3]}.",
                "evaluated",
            )

            # Segment backfill: check pointer only when a segment id is available.
            segment_id = (self.config.segment_ids_by_key or {}).get(self.SEGMENT_KEY)
            if segment_id:
                seg_backfilled, seg_ts = self.poll_committed_pointer(
                    target_ctx,
                    "segment",
                    segment_id,
                    expect_present=True,
                    timeout=recovery_timeout,
                )
                self.assertions.add(
                    "segment-backfilled-on-recovery",
                    seg_backfilled,
                    f"Target {target_ctx} segment committed pointer present after recovery "
                    f"(ts={seg_ts}).",
                    "evaluated",
                )
            else:
                self.assertions.add_skip(
                    "segment-backfilled-on-recovery",
                    f"No segment id for '{self.SEGMENT_KEY}' (seed a segment and pass "
                    "segment_ids_by_key to cover segment recovery).",
                )

            self.assertions.add_skip(
                "sdk-serves-committed-value",
                "Verifying an SDK/eval-endpoint evaluation in the recovered DC is not "
                "automated; the committed pointer above is the gated read source. Known "
                "limitation #54: clients connected through the outage may lag until reconnect.",
            )

            # --- Post-condition ---------------------------------------------------
            self._notify_step("cleanup", "running")
            self.toggle_flag(source_url, self.FLAG_KEY, False, headers)
            self.add_timeline_event("cleanup", phase="reset-flag-to-false")
            self._notify_step("cleanup", "ok")

            return self.assertions.all_passed()

        except Exception as exc:  # noqa: BLE001
            self.assertions.add_fail("runner-execution", str(exc))
            self.run_named_command(
                "partition-stop", self.config.partition_stop_command, required=False
            )
            return False
        finally:
            self.write_artifacts()
