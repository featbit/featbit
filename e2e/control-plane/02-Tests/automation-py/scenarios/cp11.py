"""CP-11: GatedCommit Slow/Down DC and Eviction (cross-DC partition).

Automates e2e/control-plane/02-Tests/manual_scripts/consistency/GatedCommitEviction.md.

Uses a single cross-DC network partition (chaos-mesh NetworkChaos applied to both
clusters) as the disruption: the isolated target DC can no longer be staged to, and once
its lease expires it is evicted so the change commits on the surviving DC while the
target's Redis stays stale. Healing the partition lets the target recover.

The partition severs everything cross-DC at once, so the "gated while still live" window
is just the lease TTL; this scenario observes it best-effort and always asserts the
robust outcomes (eviction-commit on the survivor, target stale during partition,
reconvergence after heal).
"""

import time

from core.scenario_base import ScenarioDefinition

from .consistency_base import ConsistencyScenarioBase


class CP11Scenario(ConsistencyScenarioBase):
    """CP-11 GatedCommit eviction scenario."""

    FLAG_KEY = "ff-cp11-eviction"

    def definition(self) -> ScenarioDefinition:
        # Source = west (survivor / toggles), target = east (partitioned, then evicted).
        return ScenarioDefinition(
            scenario_type="cp11",
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
            contexts = [source_ctx, target_ctx]

            if not self.is_gated_commit():
                self.assertions.add_skip(
                    "consistency-mode",
                    f"ConsistencyMode={self.config.consistency_mode}; eviction gating only "
                    "applies under GatedCommit.",
                )
                return self.assertions.all_passed()

            # This test is meaningless without a way to partition the target DC.
            if not self.config.partition_start_command:
                self.assertions.add_skip(
                    "partition-configured",
                    "No partition_start_command configured; cannot sever the cross-DC link "
                    f"to {target_ctx} to exercise commit gating + eviction.",
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
            try:
                # --- Phase 1: Baseline --------------------------------------------
                baseline = {c: self.get_committed_pointer(c, "flag", flag_id) for c in contexts}
                baseline_src = baseline.get(source_ctx)
                baseline_tgt = baseline.get(target_ctx)
                self.add_timeline_event(
                    "phase-start", phase="phase-1-baseline", result={"committed": baseline}
                )

                # --- Phase 2: Partition the target, then toggle -------------------
                self.add_timeline_event("phase-start", phase="phase-2-partition")
                self.run_named_command(
                    "partition-start", self.config.partition_start_command, required=True
                )
                partitioned = True
                # Let the chaos inject before toggling.
                time.sleep(self.config.commit_coordinator_interval_seconds)

                self.toggle_flag(source_url, self.FLAG_KEY, True, headers)
                self.assertions.add_pass("api-toggle-succeeded", "Toggle to true accepted.")

                # Best-effort: while the target's lease is still fresh (~LeaseTtlSeconds),
                # the commit should be gated — the survivor's pointer should not advance
                # yet. This window is short, so a miss is not a failure (recorded as skip).
                gated_observed = self.get_committed_pointer(source_ctx, "flag", flag_id)
                if gated_observed == baseline_src:
                    self.assertions.add_pass(
                        "commit-gated-while-live",
                        f"Survivor {source_ctx} pointer still {gated_observed} immediately "
                        "after toggle (commit gated while target lease is fresh).",
                    )
                else:
                    self.assertions.add_skip(
                        "commit-gated-while-live",
                        f"Survivor already advanced to {gated_observed} before the gate could "
                        "be observed (lease TTL window is short); eviction outcome still checked.",
                    )

                # --- Phase 3: Eviction -> commit on survivor, target stays stale ---
                self.add_timeline_event("phase-start", phase="phase-3-evict")
                evict_timeout = (
                    self.config.lease_ttl_seconds
                    + self.config.commit_coordinator_interval_seconds
                    + self.config.timeout_seconds
                )
                advanced, src_ts = self.poll_committed_pointer(
                    source_ctx, "flag", flag_id, advanced_from=baseline_src, timeout=evict_timeout
                )
                self.assertions.add(
                    "commit-after-eviction",
                    bool(advanced),
                    f"Survivor {source_ctx} committed pointer advanced to {src_ts} after the "
                    f"partitioned target's lease expired (baseline {baseline_src}).",
                    "evaluated",
                )
                target_during = self.get_committed_pointer(target_ctx, "flag", flag_id)
                self.assertions.add(
                    "target-stale-during-partition",
                    target_during == baseline_tgt and target_during != src_ts,
                    f"Partitioned target {target_ctx} pointer is stale ({target_during}) vs "
                    f"survivor ({src_ts}) while the link is severed.",
                    "evaluated",
                )
                self.run_named_command(
                    "metrics-evicted-commits",
                    self.config.consistency_metrics_check_command,
                    required=False,
                )

                # --- Phase 4: Heal -> reconverge ----------------------------------
                self.add_timeline_event("phase-start", phase="phase-4-heal")
                self.run_named_command(
                    "partition-stop", self.config.partition_stop_command, required=False
                )
                partitioned = False
                reconverged, observed = self.poll_committed_convergence(
                    "flag",
                    flag_id,
                    contexts,
                    timeout=self.config.recovery_interval_seconds * 3 + self.config.timeout_seconds,
                )
                self.assertions.add(
                    "no-permanent-divergence",
                    reconverged,
                    f"After heal, both DCs share the same committed pointer: {observed}.",
                    "evaluated",
                )
            finally:
                # Always heal the partition, even on assertion/exception paths.
                if partitioned:
                    self.run_named_command(
                        "partition-stop-cleanup",
                        self.config.partition_stop_command,
                        required=False,
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
