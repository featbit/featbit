"""CLI entry point with Click framework."""

import json
import time
from pathlib import Path
from typing import Optional

import os
import click
from dotenv import load_dotenv

from core.logging_config import configure_logging, get_logger
from core.models import ScenarioConfig
from core import reset as reset_module
from core.dashboard import SuiteDashboard, is_interactive
from scenarios import (
    CP01Scenario,
    CP02Scenario,
    CP03Scenario,
    CP04Scenario,
    CP05Scenario,
    CP06Scenario,
    CP07Scenario,
    CP08Scenario,
    CP09Scenario,
    CP10Scenario,
    CP11Scenario,
    CP12Scenario,
    CP13Scenario,
    CP14Scenario,
    CP15Scenario,
)
from scripts import seed_data as seed_module


# Load .env file if it exists
env_file = Path(__file__).resolve().parents[1] / ".env"
if env_file.exists():
    load_dotenv(env_file)

configure_logging()
logger = get_logger("automation.cli")


def get_env(key: str, default: Optional[str] = None) -> str:
    """Get environment variable with optional default."""
    return os.getenv(key, default or "")


def _log_reset_details(results: dict, log_detail: str = "summary") -> None:
    """Emit structured reset summary with optional verbose diagnostics."""
    component_keys = ["redis_west", "redis_east", "kafka", "mirrormakers", "mongodb"]
    available_components = [key for key in component_keys if key in results]
    if not available_components:
        return

    redis_west = results.get("redis_west", {})
    redis_east = results.get("redis_east", {})
    kafka = results.get("kafka", {})
    mirrormakers = results.get("mirrormakers", {})
    mongodb = results.get("mongodb", {})

    logger.info(
        "reset.summary",
        success=results.get("success", False),
        duration_seconds=results.get("duration_seconds"),
        redis_west_ok=redis_west.get("success") if "redis_west" in available_components else None,
        redis_east_ok=redis_east.get("success") if "redis_east" in available_components else None,
        kafka_ok=kafka.get("success") if "kafka" in available_components else None,
        mirrormaker_ok=(
            mirrormakers.get("success") if "mirrormakers" in available_components else None
        ),
        mongodb_ok=mongodb.get("success") if "mongodb" in available_components else None,
        available_components=available_components,
    )

    is_verbose = log_detail == "verbose"

    if not is_verbose:
        if not redis_west.get("success", False):
            logger.error(
                "reset.redis.failed",
                region="west",
                duration_seconds=redis_west.get("duration_seconds"),
                error=redis_west.get("error") or redis_west.get("output"),
            )

        if not redis_east.get("success", False):
            logger.error(
                "reset.redis.failed",
                region="east",
                duration_seconds=redis_east.get("duration_seconds"),
                error=redis_east.get("error") or redis_east.get("output"),
            )

        kafka_failed = kafka.get("failed_by_broker", {})
        if kafka_failed:
            logger.error(
                "reset.kafka.failed",
                error=kafka.get("error"),
                failed_by_broker=kafka_failed,
                duration_seconds=kafka.get("duration_seconds"),
            )

        mirrormaker_failed = {
            deployment_name: deployment_result
            for deployment_name, deployment_result in mirrormakers.get("deployments", {}).items()
            if not deployment_result.get("success", False)
        }
        if mirrormaker_failed:
            logger.error(
                "reset.mirrormaker.failed",
                error=mirrormakers.get("error"),
                failed_deployments=mirrormaker_failed,
                duration_seconds=mirrormakers.get("duration_seconds"),
            )

        mongodb_failed = [
            collection
            for collection in mongodb.get("collections", [])
            if not collection.get("success", False)
        ]
        if mongodb_failed or not mongodb.get("success", False):
            logger.error(
                "reset.mongodb.failed",
                error=mongodb.get("error"),
                context=mongodb.get("context"),
                pod=mongodb.get("pod"),
                failed_collections=mongodb_failed,
                duration_seconds=mongodb.get("duration_seconds"),
            )

        return

    for redis_key in ["redis_west", "redis_east"]:
        redis_result = results.get(redis_key, {})
        logger.info(
            "reset.redis.result",
            region=redis_key.split("_")[1],
            success=redis_result.get("success", False),
            duration_seconds=redis_result.get("duration_seconds"),
            pod=redis_result.get("pod"),
            output=redis_result.get("output") or redis_result.get("error"),
        )

    for broker_name, topic_results in kafka.get("brokers", {}).items():
        ok_count = sum(1 for topic_result in topic_results if topic_result.get("created"))
        total_count = len(topic_results)
        failed_topics = [
            {
                "topic": topic_result.get("topic"),
                "create_output": topic_result.get("create_output"),
                "delete_output": topic_result.get("delete_output"),
            }
            for topic_result in topic_results
            if not topic_result.get("created")
        ]
        logger.info(
            "reset.kafka.broker.result",
            broker=broker_name,
            ok_count=ok_count,
            total_count=total_count,
            failed_topics=failed_topics,
        )

    for deployment_name, deployment_result in mirrormakers.get("deployments", {}).items():
        logger.info(
            "reset.mirrormaker.result",
            deployment=deployment_name,
            success=deployment_result.get("success", False),
            output=deployment_result.get("output"),
        )

    logger.info(
        "reset.mongodb.result",
        success=mongodb.get("success", False),
        context=mongodb.get("context"),
        pod=mongodb.get("pod"),
        duration_seconds=mongodb.get("duration_seconds"),
        failed_collections=[
            collection
            for collection in mongodb.get("collections", [])
            if not collection.get("success", False)
        ],
    )


def _log_sequence_details(results: dict, log_detail: str = "summary") -> None:
    """Emit summary/failure details for the suite reset sequence steps."""
    if "steps" not in results:
        return

    logger.info(
        "reset.sequence.summary",
        suite=results.get("suite"),
        success=results.get("success", False),
        duration_seconds=results.get("duration_seconds"),
        steps=results.get("steps", []),
    )

    if log_detail == "verbose":
        for step in results.get("steps", []):
            logger.info("reset.sequence.step", step=step.get("name"), success=step.get("success"))
        logger.info("reset.sequence.health", health=results.get("health"))
        logger.info(
            "reset.sequence.api_scale",
            scale_down=results.get("api_scale_down"),
            scale_up=results.get("api_scale_up"),
        )
        return

    for step in results.get("steps", []):
        if not step.get("success", False):
            logger.error("reset.sequence.step_failed", step=step.get("name"))

    if not results.get("success", False):
        logger.error("reset.sequence.failed_details", health=results.get("health"))


def _log_scenario_failure_details(scenario_name: str, scenario_obj: object) -> None:
    """Emit detailed scenario assertion failures into console output."""
    failed = scenario_obj.assertions.get_failed()
    passed_count = scenario_obj.assertions.get_passed_count()
    failed_count = scenario_obj.assertions.get_failed_count()
    skipped_count = scenario_obj.assertions.get_skipped_count()

    logger.error(
        "suite.scenario.failed",
        scenario=scenario_name,
        passed_count=passed_count,
        failed_count=failed_count,
        skipped_count=skipped_count,
    )

    for assertion in failed:
        logger.error(
            "suite.scenario.failed_assertion",
            scenario=scenario_name,
            assertion=assertion.name,
            details=assertion.details,
        )

    logger.info(
        "suite.scenario.artifacts",
        scenario=scenario_name,
        artifacts_directory=str(scenario_obj.artifact_dir),
        timeline_file="timeline.json",
        assertions_file="assertions.json",
        summary_file="summary.json",
    )


@click.group()
@click.pass_context
def cli(ctx: click.Context) -> None:
    """Control-plane scenario automation suite."""
    ctx.ensure_object(dict)


@cli.command()
@click.option(
    "--seed-data",
    is_flag=True,
    help="Run seed script first to create org/project/env/flags",
)
@click.option("--env-id", help="Environment ID (required unless --seed-data used)")
@click.option(
    "--west-api-base-url",
    default=lambda: get_env("WEST_API_BASE_URL", "https://featbit-api.west.local"),
)
@click.option(
    "--east-api-base-url",
    default=lambda: get_env("EAST_API_BASE_URL", "https://featbit-api.east.local"),
)
@click.option(
    "--login-api-base-url",
    default=lambda: get_env("LOGIN_API_BASE_URL", ""),
)
@click.option("--api-authorization-header", default=lambda: get_env("API_AUTHORIZATION_HEADER", ""))
@click.option("--login-email", default=lambda: get_env("LOGIN_EMAIL", "test@featbit.com"))
@click.option("--login-password", default=lambda: get_env("LOGIN_PASSWORD", "123456"))
@click.option("--workspace-key", default=lambda: get_env("WORKSPACE_KEY", ""))
@click.option("--organization-key", default=lambda: get_env("ORGANIZATION_KEY", "playground"))
@click.option(
    "--skip-cert-check",
    is_flag=True,
    default=True,
    help="Skip TLS certificate verification",
)
@click.option(
    "--timeout-seconds",
    type=int,
    default=lambda: int(get_env("TIMEOUT_SECONDS", "60")),
)
@click.option(
    "--poll-interval-ms",
    type=int,
    default=lambda: int(get_env("POLL_INTERVAL_MS", "1000")),
)
@click.option(
    "--disruption-hold-seconds",
    type=int,
    default=lambda: int(get_env("DISRUPTION_HOLD_SECONDS", "15")),
)
@click.option(
    "--log-detail",
    type=click.Choice(["summary", "verbose"], case_sensitive=False),
    default="summary",
    help="Logging detail level",
)
@click.option("--redis-west-check", default=lambda: get_env("REDIS_WEST_CHECK_COMMAND", ""))
@click.option("--redis-east-check", default=lambda: get_env("REDIS_EAST_CHECK_COMMAND", ""))
@click.option(
    "--artifacts-root", default=lambda: get_env("ARTIFACTS_ROOT", "e2e/control-plane/artifacts")
)
def seed(
    seed_data: bool,
    env_id: Optional[str],
    west_api_base_url: str,
    east_api_base_url: str,
    login_api_base_url: str,
    api_authorization_header: str,
    login_email: str,
    login_password: str,
    workspace_key: str,
    organization_key: str,
    skip_cert_check: bool,
    timeout_seconds: int,
    poll_interval_ms: int,
    disruption_hold_seconds: int,
    log_detail: str,
    redis_west_check: str,
    redis_east_check: str,
    artifacts_root: str,
) -> None:
    """Seed control-plane QA data: create org/project/env/flags."""
    click.echo("Seeding control-plane QA data...")

    try:
        result = seed_module.seed(
            west_api_base_url=west_api_base_url,
            login_api_base_url=login_api_base_url or west_api_base_url,
            api_authorization_header=api_authorization_header or None,
            login_email=login_email,
            login_password=login_password,
            workspace_key=workspace_key,
            organization_key=organization_key,
            skip_certificate_check=skip_cert_check,
            force_flags_off=True,
            verbose=log_detail == "verbose",
        )
        click.echo("Seed completed successfully")
        click.echo(f"  Workspace: {result['workspace_id']}")
        click.echo(f"  Organization: {result['organization_id']}")
        click.echo(f"  Project: {result['project_id']}")
        click.echo(f"  Environment: {result['environment_id']}")

        # Output in key=value format for shell capture
        click.echo(f"\nEnvironment: {result['environment_id']} ({result['env_id_guid']})")
    except Exception as e:
        click.echo(f"Seed failed: {e}", err=True)
        raise SystemExit(1)


@cli.command()
@click.argument(
    "scenario",
    type=click.Choice(
        [
            "cp01-west-to-east",
            "cp01-east-to-west",
            "cp02-west-to-east",
            "cp02-east-to-west",
            "cp03-west-with-east-redis-outage",
            "cp03-east-with-west-redis-outage",
            "cp04-west-to-east",
            "cp04-east-to-west",
            "cp05-west-to-east",
            "cp05-east-to-west",
            "cp06-west-to-east",
            "cp06-east-to-west",
            "cp07-west-to-east",
            "cp07-east-to-west",
            "cp08-full-sync",
            "cp09-pod-heartbeats",
            "cp10-gatedcommit-happy-path",
            "cp11-gatedcommit-eviction",
            "cp12-gatedcommit-recovery",
            "cp13-gatedcommit-degraded-health",
            "cp14-consistency-mode-toggle",
            "cp15-cross-dc-cache-selfheal",
        ]
    ),
)
@click.option("--env-id", required=True, help="Environment ID")
@click.option(
    "--west-api-base-url",
    default=lambda: get_env("WEST_API_BASE_URL", "https://featbit-api.west.local"),
)
@click.option(
    "--east-api-base-url",
    default=lambda: get_env("EAST_API_BASE_URL", "https://featbit-api.east.local"),
)
@click.option(
    "--control-plane-base-url",
    default=lambda: get_env("CONTROL_PLANE_BASE_URL", ""),
    help="Control-Plane admin endpoint URL for CP-08 (X-Api-Key auth). Must be "
    "host-reachable: Start-PortForwards.ps1 exposes west on 127.0.0.1:5200, east "
    "on 127.0.0.1:5201. Defaults to http://featbit-control-plane.{west|east}.local, "
    "which requires the host-nginx proxy.",
)
@click.option(
    "--license-key",
    default=lambda: get_env("LICENSE_KEY", ""),
    help="Valid FeatBit license key for CP-07 license change test. "
    "When unset, CP-07 records a skip instead of failing.",
)
@click.option(
    "--login-api-base-url",
    default=lambda: get_env("LOGIN_API_BASE_URL", ""),
)
@click.option("--api-authorization-header", default=lambda: get_env("API_AUTHORIZATION_HEADER", ""))
@click.option("--login-email", default=lambda: get_env("LOGIN_EMAIL", "test@featbit.com"))
@click.option("--login-password", default=lambda: get_env("LOGIN_PASSWORD", "123456"))
@click.option("--workspace-key", default=lambda: get_env("WORKSPACE_KEY", ""))
@click.option("--organization-key", default=lambda: get_env("ORGANIZATION_KEY", "playground"))
@click.option(
    "--skip-cert-check",
    is_flag=True,
    default=True,
    help="Skip TLS certificate verification",
)
@click.option(
    "--timeout-seconds",
    type=int,
    default=lambda: int(get_env("TIMEOUT_SECONDS", "60")),
)
@click.option(
    "--poll-interval-ms",
    type=int,
    default=lambda: int(get_env("POLL_INTERVAL_MS", "1000")),
)
@click.option(
    "--disruption-hold-seconds",
    type=int,
    default=lambda: int(get_env("DISRUPTION_HOLD_SECONDS", "15")),
)
@click.option("--start-disruption", default=lambda: get_env("START_DISRUPTION_COMMAND", ""))
@click.option("--stop-disruption", default=lambda: get_env("STOP_DISRUPTION_COMMAND", ""))
@click.option("--source-topic-check", default=lambda: get_env("SOURCE_TOPIC_CHECK_COMMAND", ""))
@click.option(
    "--downstream-topic-check", default=lambda: get_env("DOWNSTREAM_TOPIC_CHECK_COMMAND", "")
)
@click.option("--retry-log-check", default=lambda: get_env("RETRY_LOG_CHECK_COMMAND", ""))
@click.option("--redis-west-check", default=lambda: get_env("REDIS_WEST_CHECK_COMMAND", ""))
@click.option("--redis-east-check", default=lambda: get_env("REDIS_EAST_CHECK_COMMAND", ""))
@click.option("--app-log-check", default=lambda: get_env("APP_LOG_CHECK_COMMAND", ""))
@click.option(
    "--ws-west-clients",
    type=int,
    default=10,
    show_default=True,
    help="CP-09 west WebSocket client count",
)
@click.option(
    "--ws-east-clients",
    type=int,
    default=20,
    show_default=True,
    help="CP-09 east WebSocket client count",
)
@click.option(
    "--ws-sdk-type",
    type=click.Choice(["server", "client"], case_sensitive=False),
    default="server",
    show_default=True,
    help="CP-09 WebSocket SDK type",
)
@click.option("--ws-disabled", is_flag=True, default=False, help="Skip CP-09 WebSocket assertions")
@click.option(
    "--ws-lb-host",
    default=lambda: get_env("WS_LB_HOST", "featbit-eval.local"),
    show_default="featbit-eval.local",
    help="CP-09 WebSocket load balancer hostname (nginx active/active LB). The "
    ".local default requires the host-nginx proxy; with the rootless proxy "
    "container use featbit-eval.127.0.0.1.sslip.io.",
)
@click.option(
    "--ws-lb-port",
    type=int,
    default=80,
    show_default=True,
    help="CP-09 WebSocket load balancer port",
)
@click.option(
    "--ws-use-load-balancer/--ws-no-load-balancer",
    default=True,
    show_default=True,
    help="Route CP-09 WebSocket clients through the nginx LB (default) or pin VUs per cluster",
)
@click.option(
    "--artifacts-root", default=lambda: get_env("ARTIFACTS_ROOT", "e2e/control-plane/artifacts")
)
# --- GatedCommit consistency options (CP-10 - CP-14) ---------------------------------
@click.option(
    "--consistency-mode",
    type=click.Choice(["GatedCommit", "BestEffort"], case_sensitive=False),
    default=lambda: get_env("CONSISTENCY_MODE", "GatedCommit"),
    help="Consistency mode the deployment is running in (CP-10 - CP-14)",
)
@click.option(
    "--lease-ttl-seconds", type=int, default=lambda: int(get_env("LEASE_TTL_SECONDS", "15"))
)
@click.option(
    "--commit-coordinator-interval-seconds",
    type=int,
    default=lambda: int(get_env("COMMIT_COORDINATOR_INTERVAL_SECONDS", "5")),
)
@click.option(
    "--recovery-interval-seconds",
    type=int,
    default=lambda: int(get_env("RECOVERY_INTERVAL_SECONDS", "10")),
)
@click.option(
    "--heartbeat-staleness-threshold-seconds",
    type=int,
    default=lambda: int(get_env("HEARTBEAT_STALENESS_THRESHOLD_SECONDS", "180")),
)
@click.option("--segment-key", default=lambda: get_env("SEGMENT_KEY", ""))
@click.option("--west-eval-readiness-url", default=lambda: get_env("WEST_EVAL_READINESS_URL", ""))
@click.option("--east-eval-readiness-url", default=lambda: get_env("EAST_EVAL_READINESS_URL", ""))
@click.option("--partition-start", default=lambda: get_env("PARTITION_START_COMMAND", ""))
@click.option("--partition-stop", default=lambda: get_env("PARTITION_STOP_COMMAND", ""))
@click.option("--heartbeat-stop", default=lambda: get_env("HEARTBEAT_STOP_COMMAND", ""))
@click.option("--heartbeat-resume", default=lambda: get_env("HEARTBEAT_RESUME_COMMAND", ""))
@click.option("--set-gatedcommit", default=lambda: get_env("SET_GATEDCOMMIT_COMMAND", ""))
@click.option("--set-besteffort", default=lambda: get_env("SET_BESTEFFORT_COMMAND", ""))
@click.option(
    "--consistency-metrics-check",
    default=lambda: get_env("CONSISTENCY_METRICS_CHECK_COMMAND", ""),
)
def scenario(
    scenario: str,
    env_id: str,
    west_api_base_url: str,
    east_api_base_url: str,
    control_plane_base_url: str,
    license_key: str,
    login_api_base_url: str,
    api_authorization_header: str,
    login_email: str,
    login_password: str,
    workspace_key: str,
    organization_key: str,
    skip_cert_check: bool,
    timeout_seconds: int,
    poll_interval_ms: int,
    disruption_hold_seconds: int,
    start_disruption: str,
    stop_disruption: str,
    source_topic_check: str,
    downstream_topic_check: str,
    retry_log_check: str,
    redis_west_check: str,
    redis_east_check: str,
    app_log_check: str,
    ws_west_clients: int,
    ws_east_clients: int,
    ws_sdk_type: str,
    ws_disabled: bool,
    ws_lb_host: str,
    ws_lb_port: int,
    ws_use_load_balancer: bool,
    artifacts_root: str,
    consistency_mode: str,
    lease_ttl_seconds: int,
    commit_coordinator_interval_seconds: int,
    recovery_interval_seconds: int,
    heartbeat_staleness_threshold_seconds: int,
    segment_key: str,
    west_eval_readiness_url: str,
    east_eval_readiness_url: str,
    partition_start: str,
    partition_stop: str,
    heartbeat_stop: str,
    heartbeat_resume: str,
    set_gatedcommit: str,
    set_besteffort: str,
    consistency_metrics_check: str,
) -> None:
    """Run a single scenario."""
    config = ScenarioConfig(
        scenario_name=scenario,
        env_id=env_id,
        west_api_base_url=west_api_base_url,
        east_api_base_url=east_api_base_url,
        control_plane_base_url=control_plane_base_url or None,
        license_key=license_key or None,
        login_api_base_url=login_api_base_url or west_api_base_url,
        api_authorization_header=api_authorization_header or None,
        login_email=login_email,
        login_password=login_password,
        workspace_key=workspace_key,
        organization_key=organization_key,
        skip_certificate_check=skip_cert_check,
        flag_key=None,
        target_status=True,
        timeout_seconds=timeout_seconds,
        poll_interval_ms=poll_interval_ms,
        disruption_hold_seconds=disruption_hold_seconds,
        start_disruption_command=start_disruption or None,
        stop_disruption_command=stop_disruption or None,
        source_topic_check_command=source_topic_check or None,
        downstream_topic_check_command=downstream_topic_check or None,
        retry_log_check_command=retry_log_check or None,
        redis_west_check_command=redis_west_check or None,
        redis_east_check_command=redis_east_check or None,
        app_log_check_command=app_log_check or None,
        artifacts_root=artifacts_root,
        ws_west_clients=ws_west_clients,
        ws_east_clients=ws_east_clients,
        ws_sdk_type=ws_sdk_type.lower(),
        ws_disabled=ws_disabled,
        ws_lb_host=ws_lb_host,
        ws_lb_port=ws_lb_port,
        ws_use_load_balancer=ws_use_load_balancer,
        consistency_mode=consistency_mode,
        lease_ttl_seconds=lease_ttl_seconds,
        commit_coordinator_interval_seconds=commit_coordinator_interval_seconds,
        recovery_interval_seconds=recovery_interval_seconds,
        heartbeat_staleness_threshold_seconds=heartbeat_staleness_threshold_seconds,
        segment_key=segment_key or None,
        west_eval_readiness_url=west_eval_readiness_url or None,
        east_eval_readiness_url=east_eval_readiness_url or None,
        partition_start_command=partition_start or None,
        partition_stop_command=partition_stop or None,
        heartbeat_stop_command=heartbeat_stop or None,
        heartbeat_resume_command=heartbeat_resume or None,
        set_gatedcommit_command=set_gatedcommit or None,
        set_besteffort_command=set_besteffort or None,
        consistency_metrics_check_command=consistency_metrics_check or None,
    )

    if scenario.startswith("cp01"):
        scenario_obj = CP01Scenario(config)
    elif scenario.startswith("cp02"):
        scenario_obj = CP02Scenario(config)
    elif scenario.startswith("cp03"):
        scenario_obj = CP03Scenario(config)
    elif scenario.startswith("cp04"):
        scenario_obj = CP04Scenario(config)
    elif scenario.startswith("cp05"):
        scenario_obj = CP05Scenario(config)
    elif scenario.startswith("cp06"):
        scenario_obj = CP06Scenario(config)
    elif scenario.startswith("cp07"):
        scenario_obj = CP07Scenario(config)
    elif scenario.startswith("cp08"):
        scenario_obj = CP08Scenario(config)
    elif scenario.startswith("cp09"):
        scenario_obj = CP09Scenario(config)
    elif scenario.startswith("cp10"):
        scenario_obj = CP10Scenario(config)
    elif scenario.startswith("cp11"):
        scenario_obj = CP11Scenario(config)
    elif scenario.startswith("cp12"):
        scenario_obj = CP12Scenario(config)
    elif scenario.startswith("cp13"):
        scenario_obj = CP13Scenario(config)
    elif scenario.startswith("cp14"):
        scenario_obj = CP14Scenario(config)
    else:
        scenario_obj = CP15Scenario(config)

    click.echo(f"Running {scenario}...")
    passed = scenario_obj.run()

    if passed:
        click.echo(f"PASS: {scenario}")
        click.echo(f"  Artifacts: {scenario_obj.artifact_dir}")
        raise SystemExit(0)
    else:
        click.echo(f"FAIL: {scenario}")
        click.echo("")

        failed = scenario_obj.assertions.get_failed()
        passed_count = scenario_obj.assertions.get_passed_count()
        failed_count = scenario_obj.assertions.get_failed_count()
        skipped_count = scenario_obj.assertions.get_skipped_count()

        click.echo(
            f"Results: {passed_count} passed | {failed_count} FAILED | {skipped_count} skipped"
        )
        click.echo("")

        if failed:
            click.echo("Failed Assertions:")
            for assertion in failed:
                click.echo(f"  - {assertion.name}")
                if assertion.details:
                    click.echo(f"      {assertion.details}")
            click.echo("")

        click.echo(f"Artifacts Directory: {scenario_obj.artifact_dir}")
        click.echo(f"  timeline.json ........... detailed event log")
        click.echo(f"  assertions.json ........ all assertion details")
        click.echo(f"  summary.json ........... overall result summary")

        raise SystemExit(1)


@cli.command(name="reset")
@click.option("--namespace", default="featbit", help="Kubernetes namespace")
@click.option(
    "--stabilization-seconds",
    type=int,
    default=30,
    help="Seconds to wait after reset for services to stabilize",
)
@click.option(
    "--log-detail",
    type=click.Choice(["summary", "verbose"]),
    default="summary",
    show_default=True,
    help="Console log detail level",
)
def reset_command(
    namespace: str,
    stabilization_seconds: int,
    log_detail: str,
) -> None:
    """Reset environment: flush Redis, clear Kafka topics, restart MirrorMaker, delete MongoDB flag data."""
    logger.info(
        "reset.command.started",
        namespace=namespace,
        stabilization_seconds=stabilization_seconds,
        log_detail=log_detail,
    )
    results = reset_module.reset_all(namespace)
    _log_reset_details(results, log_detail=log_detail)

    if results["success"]:
        logger.info("reset.command.completed", duration_seconds=results.get("duration_seconds"))
        if stabilization_seconds > 0:
            logger.info(
                "reset.command.stabilizing",
                wait_seconds=stabilization_seconds,
            )
            time.sleep(stabilization_seconds)
            logger.info("reset.command.ready")
        raise SystemExit(0)
    else:
        logger.error("reset.command.failed", duration_seconds=results.get("duration_seconds"))
        raise SystemExit(1)


class _null_context:
    """No-op context manager used when the dashboard is disabled."""

    def __enter__(self):
        return self

    def __exit__(self, *args):
        pass


@cli.command()
@click.argument(
    "suite",
    type=click.Choice(
        [
            "cp01",
            "cp02",
            "cp03",
            "cp04",
            "cp05",
            "cp06",
            "cp07",
            "cp08",
            "cp09",
            "cp10",
            "cp11",
            "cp12",
            "cp13",
            "cp14",
            "cp15",
        ]
    ),
)
@click.option(
    "--seed-data",
    is_flag=True,
    help="Run seed script first",
)
@click.option(
    "--reset",
    "reset_env",
    is_flag=True,
    help="Reset environment before running (flush Redis, clear Kafka/MongoDB)",
)
@click.option(
    "--stabilization-seconds",
    type=int,
    default=30,
    help="Seconds to wait after reset for services to stabilize",
)
@click.option(
    "--health-timeout-seconds",
    type=int,
    default=120,
    show_default=True,
    help="Max seconds to keep retrying post-reset health checks",
)
@click.option(
    "--timeout-seconds",
    type=int,
    default=lambda: int(get_env("TIMEOUT_SECONDS", "60")),
    help="Per-assertion convergence timeout for every scenario in the suite "
    "(e.g. committed-pointer polls; the first post-flip gated commit can take >60s)",
)
@click.option(
    "--control-plane-base-url",
    default=lambda: get_env("CONTROL_PLANE_BASE_URL", ""),
    help="Control-Plane admin endpoint URL for CP-08 (X-Api-Key auth). Must be "
    "host-reachable: Start-PortForwards.ps1 exposes west on 127.0.0.1:5200, east "
    "on 127.0.0.1:5201. Defaults to http://featbit-control-plane.{west|east}.local, "
    "which requires the host-nginx proxy.",
)
@click.option(
    "--health-poll-interval-seconds",
    type=int,
    default=5,
    show_default=True,
    help="Seconds between post-reset health check attempts",
)
@click.option(
    "--log-detail",
    type=click.Choice(["summary", "verbose"]),
    default="summary",
    show_default=True,
    help="Console log detail level",
)
@click.option("--env-id", help="Environment ID (required unless --seed-data used)")
@click.option(
    "--west-api-base-url",
    default=lambda: get_env("WEST_API_BASE_URL", "https://featbit-api.west.local"),
)
@click.option(
    "--east-api-base-url",
    default=lambda: get_env("EAST_API_BASE_URL", "https://featbit-api.east.local"),
)
@click.option(
    "--login-api-base-url",
    default=lambda: get_env("LOGIN_API_BASE_URL", ""),
)
@click.option("--api-authorization-header", default=lambda: get_env("API_AUTHORIZATION_HEADER", ""))
@click.option("--login-email", default=lambda: get_env("LOGIN_EMAIL", "test@featbit.com"))
@click.option("--login-password", default=lambda: get_env("LOGIN_PASSWORD", "123456"))
@click.option("--workspace-key", default=lambda: get_env("WORKSPACE_KEY", ""))
@click.option("--organization-key", default=lambda: get_env("ORGANIZATION_KEY", "playground"))
@click.option(
    "--skip-cert-check",
    is_flag=True,
    default=True,
    help="Skip TLS certificate verification",
)
@click.option("--redis-west-check", default=lambda: get_env("REDIS_WEST_CHECK_COMMAND", ""))
@click.option("--redis-east-check", default=lambda: get_env("REDIS_EAST_CHECK_COMMAND", ""))
@click.option(
    "--ws-west-clients",
    type=int,
    default=10,
    show_default=True,
    help="CP-09 west WebSocket client count",
)
@click.option(
    "--ws-east-clients",
    type=int,
    default=20,
    show_default=True,
    help="CP-09 east WebSocket client count",
)
@click.option(
    "--ws-sdk-type",
    type=click.Choice(["server", "client"], case_sensitive=False),
    default="server",
    show_default=True,
    help="CP-09 WebSocket SDK type",
)
@click.option("--ws-disabled", is_flag=True, default=False, help="Skip CP-09 WebSocket assertions")
@click.option(
    "--ws-lb-host",
    default=lambda: get_env("WS_LB_HOST", "featbit-eval.local"),
    show_default="featbit-eval.local",
    help="CP-09 WebSocket load balancer hostname (nginx active/active LB). The "
    ".local default requires the host-nginx proxy; with the rootless proxy "
    "container use featbit-eval.127.0.0.1.sslip.io.",
)
@click.option(
    "--ws-lb-port",
    type=int,
    default=80,
    show_default=True,
    help="CP-09 WebSocket load balancer port",
)
@click.option(
    "--ws-use-load-balancer/--ws-no-load-balancer",
    default=True,
    show_default=True,
    help="Route CP-09 WebSocket clients through the nginx LB (default) or pin VUs per cluster",
)
@click.option(
    "--artifacts-root", default=lambda: get_env("ARTIFACTS_ROOT", "e2e/control-plane/artifacts")
)
@click.option(
    "--chaos-mesh-manifest",
    default=lambda: get_env(
        "CHAOS_MESH_MANIFEST", "01-Infrastructure/chaos-mesh/redis-network-loss.yaml"
    ),
    help="Path to the Chaos Mesh NetworkChaos manifest for Redis disruption (CP-03). Relative paths resolve from e2e/control-plane/.",
)
@click.option(
    "--consistency-mode",
    type=click.Choice(["GatedCommit", "BestEffort"], case_sensitive=False),
    default=lambda: get_env("CONSISTENCY_MODE", "GatedCommit"),
    help="Mode the deployment runs in (CP-10 - CP-14). The suite does NOT flip cluster config.",
)
@click.option(
    "--cross-dc-partition-manifest-west",
    default=lambda: get_env(
        "CROSS_DC_PARTITION_MANIFEST_WEST",
        "01-Infrastructure/chaos-mesh/cross-dc-partition-west.yaml",
    ),
    help="NetworkChaos manifest applied to the WEST cluster for CP-11/CP-12 (must not "
    "target west's own node — see the manifest header). Relative paths resolve from "
    "e2e/control-plane/.",
)
@click.option(
    "--cross-dc-partition-manifest-east",
    default=lambda: get_env(
        "CROSS_DC_PARTITION_MANIFEST_EAST",
        "01-Infrastructure/chaos-mesh/cross-dc-partition-east.yaml",
    ),
    help="NetworkChaos manifest applied to the EAST cluster for CP-11/CP-12. Relative "
    "paths resolve from e2e/control-plane/.",
)
@click.option(
    "--eval-kafka-partition-manifest",
    default=lambda: get_env(
        "EVAL_KAFKA_PARTITION_MANIFEST", "01-Infrastructure/chaos-mesh/eval-kafka-partition.yaml"
    ),
    help="NetworkChaos manifest severing eval<->kafka in east (CP-13). Relative paths resolve "
    "from e2e/control-plane/.",
)
@click.option(
    "--east-eval-readiness-url",
    default=lambda: get_env("EAST_EVAL_READINESS_URL", ""),
    help="Host-reachable east eval /health/readiness URL for CP-13 (e.g. via port-forward); "
    "CP-13 skips its fence assertions when unset.",
)
@click.option(
    "--heartbeat-staleness-threshold-seconds",
    type=int,
    default=lambda: int(get_env("HEARTBEAT_STALENESS_THRESHOLD_SECONDS", "180")),
    help="CP-13 staleness threshold; must match the eval deployment's configured value.",
)
@click.option(
    "--no-dashboard",
    is_flag=True,
    default=False,
    help="Disable the animated dashboard (always off when stdout is not a TTY)",
)
def suite(
    suite: str,
    seed_data: bool,
    reset_env: bool,
    stabilization_seconds: int,
    health_timeout_seconds: int,
    timeout_seconds: int,
    control_plane_base_url: str,
    health_poll_interval_seconds: int,
    log_detail: str,
    env_id: Optional[str],
    west_api_base_url: str,
    east_api_base_url: str,
    login_api_base_url: str,
    api_authorization_header: str,
    login_email: str,
    login_password: str,
    workspace_key: str,
    organization_key: str,
    skip_cert_check: bool,
    redis_west_check: str,
    redis_east_check: str,
    ws_west_clients: int,
    ws_east_clients: int,
    ws_sdk_type: str,
    ws_disabled: bool,
    ws_lb_host: str,
    ws_lb_port: int,
    ws_use_load_balancer: bool,
    artifacts_root: str,
    chaos_mesh_manifest: str,
    consistency_mode: str,
    cross_dc_partition_manifest_west: str,
    cross_dc_partition_manifest_east: str,
    eval_kafka_partition_manifest: str,
    east_eval_readiness_url: str,
    heartbeat_staleness_threshold_seconds: int,
    no_dashboard: bool,
) -> None:
    """Run a test suite (CP-01, CP-02, CP-03, or CP-04)."""
    use_dashboard = not no_dashboard and is_interactive()

    seed_flag_keys = [
        "ff-cp01-basic",
        "ff-cp02-west",
        "ff-cp02-east",
        "ff-cp03-resilience",
        "ff-cp10-gatedcommit",
        "ff-cp11-eviction",
        "ff-cp12-recovery",
        "ff-cp14-mode",
    ]
    if suite == "cp01":
        scenario_names = ["cp01-west-to-east", "cp01-east-to-west"]
    elif suite == "cp02":
        scenario_names = ["cp02-west-to-east", "cp02-east-to-west"]
    elif suite == "cp03":
        scenario_names = [
            "cp03-west-with-east-redis-outage",
            "cp03-east-with-west-redis-outage",
        ]
    elif suite == "cp04":
        scenario_names = ["cp04-west-to-east", "cp04-east-to-west"]
    elif suite == "cp05":
        scenario_names = ["cp05-west-to-east", "cp05-east-to-west"]
    elif suite == "cp06":
        scenario_names = ["cp06-west-to-east", "cp06-east-to-west"]
    elif suite == "cp07":
        scenario_names = ["cp07-west-to-east", "cp07-east-to-west"]
    elif suite == "cp08":
        scenario_names = ["cp08-full-sync"]
    elif suite == "cp09":
        scenario_names = ["cp09-pod-heartbeats"]
    elif suite == "cp10":
        scenario_names = ["cp10-gatedcommit-happy-path"]
    elif suite == "cp11":
        scenario_names = ["cp11-gatedcommit-eviction"]
    elif suite == "cp12":
        scenario_names = ["cp12-gatedcommit-recovery"]
    elif suite == "cp13":
        scenario_names = ["cp13-gatedcommit-degraded-health"]
    elif suite == "cp15":
        scenario_names = ["cp15-cross-dc-cache-selfheal"]
    else:
        scenario_names = ["cp14-consistency-mode-toggle"]

    dashboard = SuiteDashboard(
        suite=suite,
        with_reset=reset_env,
        with_seed=seed_data,
        seed_flag_keys=seed_flag_keys if seed_data else None,
        scenario_names=scenario_names,
    )

    with dashboard if use_dashboard else _null_context():
        if reset_env:
            logger.info(
                "suite.reset.started",
                suite=suite,
                stabilization_seconds=stabilization_seconds,
                health_timeout_seconds=health_timeout_seconds,
                health_poll_interval_seconds=health_poll_interval_seconds,
                log_detail=log_detail,
            )
            reset_results = reset_module.reset_for_suite_sequence(
                suite_name=suite,
                stabilization_seconds=stabilization_seconds,
                west_api_base_url=west_api_base_url,
                east_api_base_url=east_api_base_url,
                skip_certificate_check=skip_cert_check,
                health_timeout_seconds=health_timeout_seconds,
                health_poll_interval_seconds=health_poll_interval_seconds,
                on_step=dashboard.update_reset_step if use_dashboard else None,
            )
            if reset_results["success"]:
                logger.info(
                    "suite.reset.completed",
                    suite=suite,
                    duration_seconds=reset_results.get("duration_seconds"),
                )
                _log_reset_details(reset_results, log_detail=log_detail)
                _log_sequence_details(reset_results, log_detail=log_detail)
                logger.info("suite.reset.ready", suite=suite)
            else:
                logger.error(
                    "suite.reset.failed",
                    suite=suite,
                    duration_seconds=reset_results.get("duration_seconds"),
                )
                _log_reset_details(reset_results, log_detail=log_detail)
                _log_sequence_details(reset_results, log_detail=log_detail)
                raise SystemExit(1)

            if not seed_data:
                logger.error(
                    "suite.seed.required_after_reset",
                    suite=suite,
                    reason="Reset deletes flags; pass --seed-data so flags are recreated before scenarios",
                )
                raise SystemExit(1)

        effective_env_id = env_id
        seeded_flag_ids_by_key: Optional[dict[str, str]] = None

        if seed_data:
            # Give API additional grace period after health check to fully initialize (readiness)
            # beyond the liveness check
            logger.info("suite.seed.grace_period", wait_seconds=15)
            time.sleep(15)

            logger.info("suite.seed.started", suite=suite)
            try:
                result = seed_module.seed(
                    west_api_base_url=west_api_base_url,
                    login_api_base_url=login_api_base_url or west_api_base_url,
                    api_authorization_header=api_authorization_header or None,
                    login_email=login_email,
                    login_password=login_password,
                    workspace_key=workspace_key,
                    organization_key=organization_key,
                    skip_certificate_check=skip_cert_check,
                    force_flags_off=True,
                    verbose=log_detail == "verbose",
                    on_flag=dashboard.update_seed_item if use_dashboard else None,
                )
                effective_env_id = result["env_id_guid"]
                seeded_flag_ids_by_key = result.get("flag_ids_by_key")
                logger.info("suite.seed.completed", suite=suite, env_id=effective_env_id)
            except Exception as e:
                logger.error("suite.seed.failed", suite=suite, error=str(e))
                raise SystemExit(1)

        if not effective_env_id:
            click.echo("Error: --env-id required unless --seed-data is used", err=True)
            raise SystemExit(1)

        def _resolve_manifest(p: str) -> str:
            mp = Path(p)
            if not mp.is_absolute():
                # Relative paths resolve from e2e/control-plane/ (parents[3] of cli/main.py).
                mp = Path(__file__).resolve().parents[3] / mp
            return str(mp.resolve())

        all_passed = True
        for scenario_name in scenario_names:
            # Build per-scenario disruption commands.
            start_cmd = None
            stop_cmd = None
            partition_start_cmd = None
            partition_stop_cmd = None
            heartbeat_stop_cmd = None
            heartbeat_resume_cmd = None
            if scenario_name.startswith("cp03"):
                manifest_path = _resolve_manifest(chaos_mesh_manifest)
                if scenario_name == "cp03-west-with-east-redis-outage":
                    target_context = "east"
                else:
                    target_context = "west"
                start_cmd = f"kubectl apply -f {manifest_path} --context {target_context}"
                stop_cmd = f"kubectl delete -f {manifest_path} --context {target_context} --ignore-not-found"
            elif scenario_name.startswith(("cp11", "cp12")):
                # CP-11/CP-12: per-cluster cross-DC partition manifests — each side
                # blocks the PEER only, never its own node (#113: a shared manifest
                # listing both peer IPs severed each cluster's node->pod traffic,
                # killing port-forwards to its own API mid-scenario).
                _mw = _resolve_manifest(cross_dc_partition_manifest_west)
                _me = _resolve_manifest(cross_dc_partition_manifest_east)
                partition_start_cmd = (
                    f"kubectl --context west apply -f {_mw} && kubectl --context east apply -f {_me}"
                )
                partition_stop_cmd = (
                    f"kubectl --context west delete -f {_mw} --ignore-not-found && "
                    f"kubectl --context east delete -f {_me} --ignore-not-found"
                )
            elif scenario_name.startswith("cp13"):
                # CP-13: intra-east eval<->kafka partition (local heartbeat break).
                _m = _resolve_manifest(eval_kafka_partition_manifest)
                heartbeat_stop_cmd = f"kubectl --context east apply -f {_m}"
                heartbeat_resume_cmd = f"kubectl --context east delete -f {_m} --ignore-not-found"

            config = ScenarioConfig(
                scenario_name=scenario_name,
                env_id=effective_env_id,
                west_api_base_url=west_api_base_url,
                east_api_base_url=east_api_base_url,
                login_api_base_url=login_api_base_url or west_api_base_url,
                api_authorization_header=api_authorization_header or None,
                login_email=login_email,
                login_password=login_password,
                workspace_key=workspace_key,
                organization_key=organization_key,
                skip_certificate_check=skip_cert_check,
                flag_key=None,
                target_status=True,
                timeout_seconds=timeout_seconds,
                control_plane_base_url=control_plane_base_url or None,
                poll_interval_ms=1000,
                disruption_hold_seconds=15,
                start_disruption_command=start_cmd,
                stop_disruption_command=stop_cmd,
                source_topic_check_command=None,
                downstream_topic_check_command=None,
                retry_log_check_command=None,
                redis_west_check_command=redis_west_check or None,
                redis_east_check_command=redis_east_check or None,
                artifacts_root=artifacts_root,
                flag_ids_by_key=seeded_flag_ids_by_key,
                ws_west_clients=ws_west_clients,
                ws_east_clients=ws_east_clients,
                ws_sdk_type=ws_sdk_type.lower(),
                ws_disabled=ws_disabled,
                ws_lb_host=ws_lb_host,
                ws_lb_port=ws_lb_port,
                ws_use_load_balancer=ws_use_load_balancer,
                consistency_mode=consistency_mode,
                partition_start_command=partition_start_cmd,
                partition_stop_command=partition_stop_cmd,
                heartbeat_stop_command=heartbeat_stop_cmd,
                heartbeat_resume_command=heartbeat_resume_cmd,
                east_eval_readiness_url=east_eval_readiness_url or None,
                heartbeat_staleness_threshold_seconds=heartbeat_staleness_threshold_seconds,
            )

            if scenario_name.startswith("cp01"):
                scenario_obj = CP01Scenario(config)
            elif scenario_name.startswith("cp02"):
                scenario_obj = CP02Scenario(config)
            elif scenario_name.startswith("cp03"):
                scenario_obj = CP03Scenario(config)
            elif scenario_name.startswith("cp04"):
                scenario_obj = CP04Scenario(config)
            elif scenario_name.startswith("cp05"):
                scenario_obj = CP05Scenario(config)
            elif scenario_name.startswith("cp06"):
                scenario_obj = CP06Scenario(config)
            elif scenario_name.startswith("cp07"):
                scenario_obj = CP07Scenario(config)
            elif scenario_name.startswith("cp08"):
                scenario_obj = CP08Scenario(config)
            elif scenario_name.startswith("cp09"):
                scenario_obj = CP09Scenario(config)
            elif scenario_name.startswith("cp10"):
                scenario_obj = CP10Scenario(config)
            elif scenario_name.startswith("cp11"):
                scenario_obj = CP11Scenario(config)
            elif scenario_name.startswith("cp12"):
                scenario_obj = CP12Scenario(config)
            elif scenario_name.startswith("cp13"):
                scenario_obj = CP13Scenario(config)
            elif scenario_name.startswith("cp14"):
                scenario_obj = CP14Scenario(config)
            else:
                scenario_obj = CP15Scenario(config)

            if use_dashboard:
                _sname = scenario_name

                def _on_step(step: str, status: str, detail: str = "", _sn: str = _sname) -> None:
                    dashboard.update_scenario_step(_sn, step, status, detail)

                scenario_obj._on_step = _on_step

            logger.info("suite.scenario.started", scenario=scenario_name)
            if use_dashboard:
                dashboard.update_scenario(scenario_name, "running")
            passed = scenario_obj.run()

            if passed:
                logger.info(
                    "suite.scenario.completed",
                    scenario=scenario_name,
                    passed=True,
                    artifacts_directory=str(scenario_obj.artifact_dir),
                )
                if use_dashboard:
                    dashboard.update_scenario(scenario_name, "ok")
            else:
                _log_scenario_failure_details(scenario_name, scenario_obj)
                if use_dashboard:
                    failed_names = ", ".join(a.name for a in scenario_obj.assertions.get_failed())
                    dashboard.update_scenario(scenario_name, "failed", detail=failed_names)
                all_passed = False

        if all_passed:
            logger.info("suite.completed", suite=suite, passed=True)
            raise SystemExit(0)
        else:
            logger.error("suite.completed", suite=suite, passed=False)
            raise SystemExit(1)


if __name__ == "__main__":
    cli(obj={})
