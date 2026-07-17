"""Pydantic models for scenarios, assertions, and timeline events."""

from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional

from pydantic import BaseModel, Field


class FlagState(BaseModel):
    """State of a feature flag from API poll."""

    region: str
    observed_at_utc: str
    is_enabled: Optional[bool] = None
    key: Optional[str] = None
    version: Optional[Any] = None
    id: Optional[str] = None
    error: Optional[str] = None

    class Config:
        populate_by_name = True


class SegmentState(BaseModel):
    """State of a segment from API poll."""

    region: str
    observed_at_utc: str
    is_present: bool = False
    id: Optional[str] = None
    key: Optional[str] = None
    name: Optional[str] = None
    version: Optional[Any] = None
    error: Optional[str] = None

    class Config:
        populate_by_name = True


class SecretState(BaseModel):
    """State of a secret from API poll."""

    region: str
    observed_at_utc: str
    is_present: bool = False
    id: Optional[str] = None
    name: Optional[str] = None
    error: Optional[str] = None

    class Config:
        populate_by_name = True


class EnvironmentState(BaseModel):
    """State of an environment from API poll."""

    region: str
    observed_at_utc: str
    is_present: bool = False
    id: Optional[str] = None
    key: Optional[str] = None
    name: Optional[str] = None
    secret_key: Optional[str] = None
    error: Optional[str] = None

    class Config:
        populate_by_name = True


class LicenseState(BaseModel):
    """State of a license from API poll."""

    region: str
    observed_at_utc: str
    is_present: bool = False
    license_key: Optional[str] = None
    is_expired: Optional[bool] = None
    error: Optional[str] = None

    class Config:
        populate_by_name = True


class AssertionResult(BaseModel):
    """Result of a single assertion."""

    name: str
    passed: bool
    status: str = "evaluated"  # evaluated, skipped
    details: str = ""

    class Config:
        populate_by_name = True


class TimelineEvent(BaseModel):
    """Single event in scenario timeline."""

    type: str  # run-start, api-toggle, poll, optional-check, disruption-command, outage-poll
    timestamp_utc: str
    run_id: Optional[str] = None
    scenario: Optional[str] = None
    source_region: Optional[str] = None
    target_region: Optional[str] = None
    api_base_url_source: Optional[str] = None
    api_base_url_target: Optional[str] = None
    env_id: Optional[str] = None
    env_key: Optional[str] = None
    flag_key: Optional[str] = None
    segment_key: Optional[str] = None
    segment_id: Optional[str] = None
    segment_name: Optional[str] = None
    secret_key: Optional[str] = None
    secret_id: Optional[str] = None
    environment_key: Optional[str] = None
    environment_id: Optional[str] = None
    environment_name: Optional[str] = None
    license_key: Optional[str] = None
    expected_status: Optional[bool] = None
    auth_type: Optional[str] = None
    workspace_id: Optional[str] = None
    organization_id: Optional[str] = None
    source: Optional[Dict[str, Any]] = None
    target: Optional[Dict[str, Any]] = None
    result: Optional[Dict[str, Any]] = None
    check: Optional[str] = None
    output: Optional[str] = None
    phase: Optional[str] = None
    elapsed_seconds: Optional[int] = None
    timeout_seconds: Optional[int] = None

    class Config:
        populate_by_name = True


@dataclass
class ScenarioConfig:
    """Configuration for a scenario run."""

    scenario_name: str
    env_id: str
    west_api_base_url: str
    east_api_base_url: str
    login_api_base_url: str
    login_email: str
    login_password: str
    workspace_key: str
    organization_key: str
    skip_certificate_check: bool
    target_status: bool
    timeout_seconds: int
    poll_interval_ms: int
    disruption_hold_seconds: int
    artifacts_root: str
    control_plane_base_url: Optional[str] = None
    license_key: Optional[str] = None
    api_authorization_header: Optional[str] = None
    flag_key: Optional[str] = None
    start_disruption_command: Optional[str] = None
    stop_disruption_command: Optional[str] = None
    source_topic_check_command: Optional[str] = None
    downstream_topic_check_command: Optional[str] = None
    retry_log_check_command: Optional[str] = None
    redis_west_check_command: Optional[str] = None
    redis_east_check_command: Optional[str] = None
    app_log_check_command: Optional[str] = None
    api_version: str = "1"
    flag_ids_by_key: Optional[Dict[str, str]] = None
    segment_ids_by_key: Optional[Dict[str, str]] = None
    convergence_timeout_seconds: Optional[int] = None
    convergence_poll_interval_seconds: Optional[int] = None
    ws_west_clients: int = 10
    ws_east_clients: int = 20
    ws_sdk_type: str = "server"
    ws_disabled: bool = False
    ws_use_load_balancer: bool = True
    ws_lb_host: str = "featbit-eval.local"
    ws_lb_port: int = 80
    # --- GatedCommit consistency scenarios (CP-10 – CP-14) -----------------------
    consistency_mode: str = "GatedCommit"  # or "BestEffort"
    lease_ttl_seconds: int = 15
    commit_coordinator_interval_seconds: int = 5
    recovery_interval_seconds: int = 10
    heartbeat_staleness_threshold_seconds: int = 180
    segment_key: Optional[str] = None
    west_eval_readiness_url: Optional[str] = None
    east_eval_readiness_url: Optional[str] = None
    # Sever / heal the cross-DC network link (CP-11 eviction, CP-12 recovery). A single
    # partition models a real DC outage: the isolated DC's Redis goes stale AND its lease
    # expires (evicted), then heals/recovers. Typically a chaos-mesh NetworkChaos applied
    # to both clusters.
    partition_start_command: Optional[str] = None
    partition_stop_command: Optional[str] = None
    # Stop / resume a DC's evaluation-server heartbeats (CP-13 local readiness fence).
    heartbeat_stop_command: Optional[str] = None
    heartbeat_resume_command: Optional[str] = None
    # Flip ConsistencyMode and restart services (CP-14 mode toggle / rollback).
    set_gatedcommit_command: Optional[str] = None
    set_besteffort_command: Optional[str] = None
    # Scrape the FeatBit.ControlPlane.Consistency meter (commits, evicted_commits, ...).
    consistency_metrics_check_command: Optional[str] = None


class ScenariosummaryJson(BaseModel):
    """Overall scenario run summary."""

    run_id: str
    scenario: str
    started_utc: str
    finished_utc: str
    env_id: str
    flag_key: str
    source_region: str
    target_region: str
    expected_status: bool
    passed: bool
    failed_assertions: list[AssertionResult] = Field(default_factory=list)
    artifacts: Dict[str, str]

    class Config:
        populate_by_name = True
