"""Reset environment state: clear Redis, Kafka topics, and MongoDB flag records."""

import json
import subprocess
import time
from typing import Any, Dict, List, Optional

import requests

from core.logging_config import get_logger

KAFKA_TOPICS_TO_RESET = [
    "featbit-feature-flag-change",
    "featbit-segment-change",
    "featbit-control-plane-feature-flag-change",
    "featbit-control-plane-segment-change",
    "featbit-control-plane-secret-change",
    "featbit-control-plane-license-change",
    "featbit-control-plane-command",
    "featbit-connection-made",
    "featbit-connection-closed",
    "featbit-pod-heartbeat",
]

MONGO_COLLECTIONS_TO_CLEAR = [
    "FeatureFlags",
    "FlagRevisions",
    "FlagDrafts",
    "FlagSchedules",
    "FlagChangeRequests",
]

MONGO_DATABASE = "featbit"
MONGO_USER = "admin"
MONGO_PASSWORD = "password"
MONGO_AUTH_SOURCE = "admin"

KAFKA_POD = "kafka"
KAFKA_BIN = "/opt/bitnami/kafka/bin"
KAFKA_BOOTSTRAP = "kafka:9092"
KAFKA_AGGREGATE_BOOTSTRAP = "kafka-aggregate:9092"

MIRRORMAKER_DEPLOYMENTS = [
    "kafka-mirrormaker-local",
    "kafka-mirrormaker-remote",
]

REDIS_READY_TIMEOUT_SECONDS = 120
REDIS_READY_POLL_INTERVAL_SECONDS = 5

SUITE_KAFKA_TOPICS: Dict[str, List[str]] = {
    "cp02": [
        "featbit-feature-flag-change",
        "featbit-control-plane-feature-flag-change",
    ],
    "cp03": [
        "featbit-feature-flag-change",
        "featbit-control-plane-feature-flag-change",
    ],
}

logger = get_logger("automation.reset")


def topics_for_suite(suite_name: str) -> List[str]:
    """Return Kafka topics relevant to a suite, falling back to full reset set."""
    return SUITE_KAFKA_TOPICS.get(suite_name, KAFKA_TOPICS_TO_RESET)


def _discover_api_deployments(context: str, namespace: str) -> Dict[str, Any]:
    """Discover featbit API deployments and their current replica counts."""
    # Prefer the known deployment name first for deterministic behavior.
    direct = _run_kubectl(
        context,
        ["-n", namespace, "get", "deployment", "api-server", "-o", "json"],
    )
    if direct.returncode == 0:
        try:
            item = json.loads(direct.stdout)
            return {
                "success": True,
                "context": context,
                "deployments": [
                    {
                        "name": "api-server",
                        "replicas": int(item.get("spec", {}).get("replicas", 1)),
                    }
                ],
            }
        except json.JSONDecodeError:
            return {
                "success": False,
                "context": context,
                "error": "Unable to parse api-server deployment JSON",
            }

    result = _run_kubectl(
        context,
        ["-n", namespace, "get", "deployments", "-o", "json"],
    )
    if result.returncode != 0:
        return {
            "success": False,
            "context": context,
            "error": (result.stdout + result.stderr).strip(),
        }

    deployments: List[Dict[str, Any]] = []
    try:
        items = json.loads(result.stdout).get("items", [])
        for item in items:
            name = item.get("metadata", {}).get("name", "")
            if (
                name == "api-server"
                or "featbit-api" in name
                or "api-server" in name
                or name.endswith("-api")
                or name == "api"
            ):
                deployments.append(
                    {
                        "name": name,
                        "replicas": int(item.get("spec", {}).get("replicas", 1)),
                    }
                )
    except json.JSONDecodeError:
        return {
            "success": False,
            "context": context,
            "error": "Unable to parse deployment list JSON",
        }

    if not deployments:
        return {
            "success": False,
            "context": context,
            "error": f"No featbit API deployments found in {context}/{namespace}",
        }

    return {"success": True, "context": context, "deployments": deployments}


def _scale_api_deployments(
    context: str,
    namespace: str,
    deployment_targets: Dict[str, int],
) -> Dict[str, Any]:
    """Scale API deployments to target replica counts and wait for rollouts when scaling up."""
    started_at = time.perf_counter()
    details: Dict[str, Dict[str, Any]] = {}

    for deployment_name, replicas in deployment_targets.items():
        scale = _run_kubectl(
            context,
            [
                "-n",
                namespace,
                "scale",
                f"deployment/{deployment_name}",
                f"--replicas={replicas}",
            ],
            timeout=45,
        )

        scale_output = (scale.stdout + scale.stderr).strip()
        deployment_result: Dict[str, Any] = {
            "success": scale.returncode == 0,
            "replicas": replicas,
            "scale_output": scale_output,
        }

        if scale.returncode == 0 and replicas > 0:
            rollout = _run_kubectl(
                context,
                [
                    "-n",
                    namespace,
                    "rollout",
                    "status",
                    f"deployment/{deployment_name}",
                    "--timeout=240s",
                ],
                timeout=250,
            )
            deployment_result["success"] = rollout.returncode == 0
            deployment_result["rollout_output"] = (rollout.stdout + rollout.stderr).strip()

        details[deployment_name] = deployment_result

    success = all(item.get("success", False) for item in details.values())
    duration_seconds = round(time.perf_counter() - started_at, 3)
    return {
        "success": success,
        "context": context,
        "duration_seconds": duration_seconds,
        "deployments": details,
    }


def scale_down_api_pods(
    contexts: Optional[List[str]] = None,
    namespace: str = "featbit",
) -> Dict[str, Any]:
    """Scale down API deployments in all target contexts and capture original replica counts."""
    contexts = contexts or ["west", "east"]
    started_at = time.perf_counter()
    logger.info("reset.api.scale_down.started", contexts=contexts, namespace=namespace)

    snapshots: Dict[str, Dict[str, int]] = {}
    per_context: Dict[str, Dict[str, Any]] = {}

    for context in contexts:
        discovered = _discover_api_deployments(context, namespace)
        if not discovered.get("success", False):
            per_context[context] = discovered
            continue

        targets: Dict[str, int] = {}
        snapshot: Dict[str, int] = {}
        for deployment in discovered.get("deployments", []):
            name = deployment["name"]
            snapshot[name] = int(deployment.get("replicas", 1))
            targets[name] = 0

        snapshots[context] = snapshot
        scaled = _scale_api_deployments(context, namespace, targets)
        per_context[context] = scaled

    success = all(result.get("success", False) for result in per_context.values())
    duration_seconds = round(time.perf_counter() - started_at, 3)
    if success:
        logger.info("reset.api.scale_down.completed", duration_seconds=duration_seconds)
    else:
        logger.error("reset.api.scale_down.failed", duration_seconds=duration_seconds, details=per_context)

    return {
        "success": success,
        "duration_seconds": duration_seconds,
        "snapshots": snapshots,
        "contexts": per_context,
    }


def scale_up_api_pods(
    snapshots: Dict[str, Dict[str, int]],
    namespace: str = "featbit",
) -> Dict[str, Any]:
    """Scale up API deployments back to their captured replica counts."""
    started_at = time.perf_counter()
    logger.info("reset.api.scale_up.started", namespace=namespace)
    per_context: Dict[str, Dict[str, Any]] = {}

    for context, deployment_snapshot in snapshots.items():
        per_context[context] = _scale_api_deployments(
            context,
            namespace,
            deployment_snapshot,
        )

    success = all(result.get("success", False) for result in per_context.values())
    duration_seconds = round(time.perf_counter() - started_at, 3)
    if success:
        logger.info("reset.api.scale_up.completed", duration_seconds=duration_seconds)
    else:
        logger.error("reset.api.scale_up.failed", duration_seconds=duration_seconds, details=per_context)

    return {
        "success": success,
        "duration_seconds": duration_seconds,
        "contexts": per_context,
    }


def verify_redis_ping(context: str, namespace: str = "featbit") -> Dict[str, Any]:
    """Verify Redis responds to PING in a context."""
    pod_name = _discover_pod(context, namespace, "app=redis", "redis")
    if not pod_name:
        return {
            "success": False,
            "context": context,
            "error": f"No running redis pod found in {context}/{namespace}",
        }

    ping = _run_kubectl(
        context,
        ["-n", namespace, "exec", pod_name, "--", "redis-cli", "PING"],
        timeout=15,
    )
    output = (ping.stdout + ping.stderr).strip()
    success = ping.returncode == 0 and "PONG" in ping.stdout.upper()
    return {
        "success": success,
        "context": context,
        "pod": pod_name,
        "output": output,
        "error": None if success else output or "Redis PING failed",
    }


def verify_post_reset_health(
    west_api_base_url: str,
    east_api_base_url: str,
    skip_certificate_check: bool = True,
    contexts: Optional[List[str]] = None,
    namespace: str = "featbit",
    health_timeout_seconds: int = 120,
    health_poll_interval_seconds: int = 5,
) -> Dict[str, Any]:
    """Verify required post-reset health gates for Redis and API endpoints.

    Retries health checks until success or timeout to tolerate transient startup failures.
    """
    started_at = time.perf_counter()
    contexts = contexts or ["west", "east"]
    logger.info(
        "reset.health.started",
        contexts=contexts,
        health_timeout_seconds=health_timeout_seconds,
        health_poll_interval_seconds=health_poll_interval_seconds,
    )

    deadline = time.time() + max(1, health_timeout_seconds)
    attempt = 0
    redis_checks: Dict[str, Dict[str, Any]] = {}
    endpoint_checks: Dict[str, Dict[str, Any]] = {}

    while True:
        attempt += 1
        redis_checks = {
            context: verify_redis_ping(context, namespace)
            for context in contexts
        }

        endpoint_checks = {}
        for region, base_url in {"west": west_api_base_url, "east": east_api_base_url}.items():
            health_url = f"{base_url.rstrip('/')}/health/readiness"
            try:
                response = requests.get(health_url, timeout=15, verify=not skip_certificate_check)
                endpoint_checks[region] = {
                    "success": response.status_code == 200,
                    "status_code": response.status_code,
                    "url": health_url,
                    "error": None if response.status_code == 200 else f"HTTP {response.status_code}",
                }
            except requests.RequestException as exc:
                endpoint_checks[region] = {
                    "success": False,
                    "status_code": None,
                    "url": health_url,
                    "error": str(exc),
                }

        success = all(item.get("success", False) for item in redis_checks.values()) and all(
            item.get("success", False) for item in endpoint_checks.values()
        )
        if success:
            duration_seconds = round(time.perf_counter() - started_at, 3)
            logger.info(
                "reset.health.completed",
                duration_seconds=duration_seconds,
                attempts=attempt,
            )
            return {
                "success": True,
                "duration_seconds": duration_seconds,
                "attempts": attempt,
                "redis": redis_checks,
                "api": endpoint_checks,
            }

        now = time.time()
        if now >= deadline:
            duration_seconds = round(time.perf_counter() - started_at, 3)
            logger.error(
                "reset.health.failed",
                duration_seconds=duration_seconds,
                attempts=attempt,
                redis=redis_checks,
                api=endpoint_checks,
            )
            return {
                "success": False,
                "duration_seconds": duration_seconds,
                "attempts": attempt,
                "redis": redis_checks,
                "api": endpoint_checks,
            }

        remaining_seconds = int(max(0, deadline - now))
        logger.info(
            "reset.health.retrying",
            attempt=attempt,
            remaining_seconds=remaining_seconds,
            next_check_in_seconds=health_poll_interval_seconds,
            west_api_status=endpoint_checks.get("west", {}).get("status_code"),
            east_api_status=endpoint_checks.get("east", {}).get("status_code"),
        )
        time.sleep(max(1, health_poll_interval_seconds))


def _run_kubectl(
    context: str, args: list[str], timeout: int = 30
) -> subprocess.CompletedProcess[str]:
    """Run kubectl command against a cluster context."""
    return subprocess.run(
        ["kubectl", "--context", context, *args],
        capture_output=True,
        text=True,
        timeout=timeout,
    )


def _discover_pod(
    context: str, namespace: str, label: Optional[str], name_prefix: str
) -> Optional[str]:
    """Find a running pod by label or name prefix."""
    pods = _discover_all_pods(context, namespace, label, name_prefix)
    return pods[0] if pods else None


def _discover_all_pods(
    context: str, namespace: str, label: Optional[str], name_prefix: str
) -> List[str]:
    """Find all running pods matching a label or name prefix."""
    found: List[str] = []

    if label:
        result = _run_kubectl(
            context, ["-n", namespace, "get", "pods", "-l", label, "-o", "json"]
        )
        if result.returncode == 0:
            try:
                items = json.loads(result.stdout).get("items", [])
                for item in items:
                    if item.get("status", {}).get("phase") == "Running":
                        found.append(item.get("metadata", {}).get("name", ""))
            except json.JSONDecodeError:
                pass
        if found:
            return found

    result = _run_kubectl(
        context, ["-n", namespace, "get", "pods", "-o", "json"]
    )
    if result.returncode != 0:
        return []

    try:
        items = json.loads(result.stdout).get("items", [])
        for item in items:
            name = item.get("metadata", {}).get("name", "")
            phase = item.get("status", {}).get("phase")
            if name.startswith(name_prefix) and phase == "Running":
                found.append(name)
    except json.JSONDecodeError:
        pass

    return found


def _restart_redis_workload(context: str, namespace: str) -> Dict[str, Any]:
    """Try restarting Redis deployment/statefulset to recover from a missing pod."""
    attempts = [
        ("deployment", "redis"),
        ("statefulset", "redis"),
    ]

    for kind, name in attempts:
        restart = _run_kubectl(
            context,
            ["-n", namespace, "rollout", "restart", f"{kind}/{name}"],
            timeout=30,
        )
        if restart.returncode != 0:
            continue

        rollout = _run_kubectl(
            context,
            ["-n", namespace, "rollout", "status", f"{kind}/{name}", "--timeout=120s"],
            timeout=130,
        )
        output = (restart.stdout + restart.stderr + rollout.stdout + rollout.stderr).strip()
        return {
            "success": rollout.returncode == 0,
            "resource": f"{kind}/{name}",
            "output": output,
        }

    return {
        "success": False,
        "resource": None,
        "output": "Unable to restart Redis workload (deployment/redis or statefulset/redis not found).",
    }


def ensure_redis_running(
    context: str,
    namespace: str = "featbit",
    timeout_seconds: int = REDIS_READY_TIMEOUT_SECONDS,
    poll_interval_seconds: int = REDIS_READY_POLL_INTERVAL_SECONDS,
) -> Dict[str, Any]:
    """Wait until Redis is running and responds to PING."""
    started_at = time.perf_counter()
    deadline = time.time() + max(1, timeout_seconds)
    attempted_restart = False
    attempt = 0
    last_check: Dict[str, Any] = {
        "success": False,
        "context": context,
        "error": "Redis readiness check did not start",
    }

    logger.info(
        "reset.redis.ensure.started",
        context=context,
        namespace=namespace,
        timeout_seconds=timeout_seconds,
        poll_interval_seconds=poll_interval_seconds,
    )

    while time.time() <= deadline:
        attempt += 1
        last_check = verify_redis_ping(context, namespace)
        if last_check.get("success", False):
            duration_seconds = round(time.perf_counter() - started_at, 3)
            logger.info(
                "reset.redis.ensure.completed",
                context=context,
                attempts=attempt,
                duration_seconds=duration_seconds,
                pod=last_check.get("pod"),
            )
            return {
                "success": True,
                "context": context,
                "attempts": attempt,
                "duration_seconds": duration_seconds,
                "pod": last_check.get("pod"),
                "details": last_check,
            }

        if not attempted_restart and "No running redis pod found" in str(last_check.get("error", "")):
            restart = _restart_redis_workload(context, namespace)
            attempted_restart = True
            if restart.get("success", False):
                logger.info(
                    "reset.redis.ensure.restart_triggered",
                    context=context,
                    resource=restart.get("resource"),
                )
            else:
                logger.warning(
                    "reset.redis.ensure.restart_failed",
                    context=context,
                    output=restart.get("output"),
                )

        time.sleep(max(1, poll_interval_seconds))

    duration_seconds = round(time.perf_counter() - started_at, 3)
    logger.error(
        "reset.redis.ensure.failed",
        context=context,
        attempts=attempt,
        duration_seconds=duration_seconds,
        last_error=last_check.get("error"),
    )
    return {
        "success": False,
        "context": context,
        "attempts": attempt,
        "duration_seconds": duration_seconds,
        "error": last_check.get("error") or "Redis did not become ready before timeout",
        "details": last_check,
    }


def reset_redis(context: str, namespace: str = "featbit") -> Dict[str, Any]:
    """Flush all Redis data in a cluster."""
    started_at = time.perf_counter()
    logger.info("reset.redis.started", context=context, namespace=namespace)

    pod_name = _discover_pod(context, namespace, "app=redis", "redis")
    if not pod_name:
        duration_seconds = round(time.perf_counter() - started_at, 3)
        error = f"No running redis pod found in {context}/{namespace}"
        logger.error(
            "reset.redis.failed",
            context=context,
            namespace=namespace,
            duration_seconds=duration_seconds,
            error=error,
        )
        return {
            "success": False,
            "context": context,
            "error": error,
            "duration_seconds": duration_seconds,
        }

    flush = _run_kubectl(
        context,
        ["-n", namespace, "exec", pod_name, "--", "redis-cli", "FLUSHALL"],
        timeout=15,
    )

    output = (flush.stdout + flush.stderr).strip()
    duration_seconds = round(time.perf_counter() - started_at, 3)

    if flush.returncode == 0 and "OK" in flush.stdout.upper():
        logger.info(
            "reset.redis.completed",
            context=context,
            pod=pod_name,
            duration_seconds=duration_seconds,
        )
        return {
            "success": True,
            "context": context,
            "pod": pod_name,
            "output": output,
            "duration_seconds": duration_seconds,
        }

    logger.error(
        "reset.redis.failed",
        context=context,
        pod=pod_name,
        duration_seconds=duration_seconds,
        output=output,
    )
    return {
        "success": False,
        "context": context,
        "pod": pod_name,
        "output": output,
        "error": output or "redis FLUSHALL failed",
        "duration_seconds": duration_seconds,
    }


def _reset_broker_topics(
    context: str,
    namespace: str,
    exec_pod: str,
    bootstrap: str,
    topics: List[str],
) -> List[Dict[str, Any]]:
    """Delete and recreate topics on a specific Kafka broker."""
    results = []

    for topic in topics:
        topic_started_at = time.perf_counter()
        logger.info(
            "reset.kafka.topic.started",
            context=context,
            bootstrap=bootstrap,
            topic=topic,
        )

        delete_result = _run_kubectl(
            context,
            [
                "-n", namespace, "exec", exec_pod, "--",
                f"{KAFKA_BIN}/kafka-topics.sh",
                "--bootstrap-server", bootstrap,
                "--delete",
                "--topic", topic,
            ],
            timeout=15,
        )
        delete_output = (delete_result.stdout + delete_result.stderr).strip()

        create_result = _run_kubectl(
            context,
            [
                "-n", namespace, "exec", exec_pod, "--",
                f"{KAFKA_BIN}/kafka-topics.sh",
                "--bootstrap-server", bootstrap,
                "--create",
                "--topic", topic,
                "--partitions", "1",
                "--replication-factor", "1",
                "--if-not-exists",
            ],
            timeout=15,
        )
        create_output = (create_result.stdout + create_result.stderr).strip()

        topic_result = {
            "topic": topic,
            "deleted": delete_result.returncode == 0 or "does not exist" in delete_output.lower(),
            "created": create_result.returncode == 0,
            "delete_output": delete_output,
            "create_output": create_output,
            "duration_seconds": round(time.perf_counter() - topic_started_at, 3),
        }

        if topic_result["created"]:
            logger.info(
                "reset.kafka.topic.completed",
                context=context,
                bootstrap=bootstrap,
                topic=topic,
                duration_seconds=topic_result["duration_seconds"],
            )
        else:
            logger.error(
                "reset.kafka.topic.failed",
                context=context,
                bootstrap=bootstrap,
                topic=topic,
                duration_seconds=topic_result["duration_seconds"],
                delete_output=delete_output,
                create_output=create_output,
            )

        results.append(topic_result)

    return results


def reset_kafka_topics(
    contexts: Optional[List[str]] = None,
    namespace: str = "featbit",
    topics: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Delete and recreate Kafka topics on main and aggregate brokers across clusters."""
    started_at = time.perf_counter()
    topics = topics or KAFKA_TOPICS_TO_RESET
    contexts = contexts or ["west", "east"]
    brokers: Dict[str, List[Dict[str, Any]]] = {}

    logger.info(
        "reset.kafka.started",
        contexts=contexts,
        namespace=namespace,
        topic_count=len(topics),
    )

    for context in contexts:
        brokers[f"{context}/kafka"] = _reset_broker_topics(
            context, namespace, KAFKA_POD, KAFKA_BOOTSTRAP, topics
        )
        brokers[f"{context}/kafka-aggregate"] = _reset_broker_topics(
            context, namespace, KAFKA_POD, KAFKA_AGGREGATE_BOOTSTRAP, topics
        )

    all_topic_results = [r for broker_topics in brokers.values() for r in broker_topics]
    ok_count = sum(1 for r in all_topic_results if r["created"])
    total = len(all_topic_results)
    failed_by_broker: Dict[str, List[Dict[str, str]]] = {}

    for broker_name, broker_topics in brokers.items():
        failed_topics = [
            {
                "topic": topic_result["topic"],
                "delete_output": topic_result["delete_output"],
                "create_output": topic_result["create_output"],
            }
            for topic_result in broker_topics
            if not topic_result["created"]
        ]
        if failed_topics:
            failed_by_broker[broker_name] = failed_topics

    success = all(r["created"] for r in all_topic_results)
    duration_seconds = round(time.perf_counter() - started_at, 3)
    if success:
        logger.info(
            "reset.kafka.completed",
            duration_seconds=duration_seconds,
            ok_count=ok_count,
            total=total,
        )
    else:
        logger.error(
            "reset.kafka.failed",
            duration_seconds=duration_seconds,
            ok_count=ok_count,
            total=total,
            failed_by_broker=failed_by_broker,
        )

    error = None
    if not success:
        error = f"Kafka topic recreate failed for {total - ok_count} of {total} topic operations"

    return {
        "success": success,
        "brokers": brokers,
        "failed_by_broker": failed_by_broker,
        "ok_count": ok_count,
        "total": total,
        "error": error,
        "duration_seconds": duration_seconds,
    }


def _run_mongosh(
    context: str, namespace: str, pod: str, js_command: str, timeout: int = 15
) -> subprocess.CompletedProcess[str]:
    """Run mongosh eval on a pod, trying without auth first then with auth."""
    result = _run_kubectl(
        context,
        [
            "-n", namespace, "exec", pod, "--",
            "mongosh", "--quiet", "--eval", js_command,
        ],
        timeout=timeout,
    )
    if result.returncode == 0:
        return result

    return _run_kubectl(
        context,
        [
            "-n", namespace, "exec", pod, "--",
            "mongosh", "--quiet",
            "-u", MONGO_USER,
            "-p", MONGO_PASSWORD,
            "--authenticationDatabase", MONGO_AUTH_SOURCE,
            "--eval", js_command,
        ],
        timeout=timeout,
    )


def _find_mongo_primary(
    contexts: List[str], namespace: str
) -> Optional[tuple[str, str]]:
    """Find the replica set primary across multiple clusters.

    Returns:
        (context, pod_name) of the primary, or None if not found.
    """
    for context in contexts:
        pods = _discover_all_pods(context, namespace, None, "mongodb")
        for pod in pods:
            result = _run_mongosh(
                context, namespace, pod, "rs.hello().isWritablePrimary"
            )
            if result.returncode == 0 and "true" in result.stdout.strip().lower():
                return (context, pod)

    return None


def reset_mongodb_flags(
    contexts: Optional[List[str]] = None,
    namespace: str = "featbit",
    collections: Optional[List[str]] = None,
) -> Dict[str, Any]:
    """Clear flag-related collections in MongoDB (finds replica set primary across clusters)."""
    started_at = time.perf_counter()
    collections = collections or MONGO_COLLECTIONS_TO_CLEAR
    contexts = contexts or ["west", "east"]

    logger.info(
        "reset.mongodb.started",
        contexts=contexts,
        namespace=namespace,
        collection_count=len(collections),
    )

    primary = _find_mongo_primary(contexts, namespace)
    if not primary:
        duration_seconds = round(time.perf_counter() - started_at, 3)
        error = f"No MongoDB primary found in clusters {contexts}/{namespace}"
        logger.error(
            "reset.mongodb.failed",
            duration_seconds=duration_seconds,
            error=error,
        )
        return {
            "success": False,
            "error": error,
            "duration_seconds": duration_seconds,
        }

    primary_context, pod_name = primary

    results = []
    for collection in collections:
        js_command = f'db.getSiblingDB("{MONGO_DATABASE}").{collection}.deleteMany({{}})'

        drop_result = _run_mongosh(
            primary_context, namespace, pod_name, js_command, timeout=30
        )

        output = (drop_result.stdout + drop_result.stderr).strip()
        results.append({
            "collection": collection,
            "success": drop_result.returncode == 0,
            "output": output,
        })

    all_ok = all(r["success"] for r in results)
    duration_seconds = round(time.perf_counter() - started_at, 3)
    failed_collections = [r for r in results if not r["success"]]
    if all_ok:
        logger.info(
            "reset.mongodb.completed",
            context=primary_context,
            pod=pod_name,
            duration_seconds=duration_seconds,
        )
    else:
        logger.error(
            "reset.mongodb.failed",
            context=primary_context,
            pod=pod_name,
            duration_seconds=duration_seconds,
            failed_collections=failed_collections,
        )

    error = None
    if not all_ok:
        failed_names = [item["collection"] for item in failed_collections]
        error = f"MongoDB deleteMany failed for collections: {', '.join(failed_names)}"

    return {
        "success": all_ok,
        "context": primary_context,
        "pod": pod_name,
        "collections": results,
        "error": error,
        "duration_seconds": duration_seconds,
    }


def restart_mirrormakers(
    contexts: Optional[List[str]] = None,
    namespace: str = "featbit",
) -> Dict[str, Any]:
    """Restart MirrorMaker deployments to re-establish consumer subscriptions after topic recreation."""
    started_at = time.perf_counter()
    contexts = contexts or ["west", "east"]
    deployments: Dict[str, Dict[str, Any]] = {}

    logger.info(
        "reset.mirrormaker.started",
        contexts=contexts,
        namespace=namespace,
        deployment_count=len(MIRRORMAKER_DEPLOYMENTS),
    )

    for context in contexts:
        for name in MIRRORMAKER_DEPLOYMENTS:
            key = f"{context}/{name}"
            restart = _run_kubectl(
                context,
                ["-n", namespace, "rollout", "restart", f"deployment/{name}"],
                timeout=30,
            )
            if restart.returncode != 0:
                deployments[key] = {
                    "success": False,
                    "output": (restart.stdout + restart.stderr).strip(),
                }
                continue

            rollout = _run_kubectl(
                context,
                ["-n", namespace, "rollout", "status", f"deployment/{name}", "--timeout=120s"],
                timeout=130,
            )
            deployments[key] = {
                "success": rollout.returncode == 0,
                "output": (rollout.stdout + rollout.stderr).strip(),
            }

    all_ok = all(d["success"] for d in deployments.values())
    duration_seconds = round(time.perf_counter() - started_at, 3)
    failed_deployments = {
        deployment: details
        for deployment, details in deployments.items()
        if not details["success"]
    }
    if all_ok:
        logger.info("reset.mirrormaker.completed", duration_seconds=duration_seconds)
    else:
        logger.error(
            "reset.mirrormaker.failed",
            duration_seconds=duration_seconds,
            failed_deployments=failed_deployments,
        )

    error = None
    if failed_deployments:
        error = "MirrorMaker rollout restart/status failed for one or more deployments"

    return {
        "success": all_ok,
        "deployments": deployments,
        "error": error,
        "duration_seconds": duration_seconds,
    }


def reset_all(
    namespace: str = "featbit",
) -> Dict[str, Any]:
    """Full environment reset: Redis, Kafka topics (all brokers), MirrorMaker restart, MongoDB flags."""
    started_at = time.perf_counter()
    logger.info("reset.all.started", namespace=namespace)

    results: Dict[str, Any] = {}

    results["redis_west_ready"] = ensure_redis_running("west", namespace)
    results["redis_east_ready"] = ensure_redis_running("east", namespace)

    redis_ready_success = results["redis_west_ready"].get("success", False) and results[
        "redis_east_ready"
    ].get("success", False)
    if not redis_ready_success:
        results["success"] = False
        results["duration_seconds"] = round(time.perf_counter() - started_at, 3)
        logger.error(
            "reset.all.failed",
            duration_seconds=results["duration_seconds"],
            step="redis_readiness",
            redis_west_ready=results["redis_west_ready"],
            redis_east_ready=results["redis_east_ready"],
        )
        return results

    results["redis_west"] = reset_redis("west", namespace)
    results["redis_east"] = reset_redis("east", namespace)
    results["kafka"] = reset_kafka_topics(["west", "east"], namespace)
    results["mirrormakers"] = restart_mirrormakers(["west", "east"], namespace)
    results["mongodb"] = reset_mongodb_flags(["west", "east"], namespace)

    overall = all(
        results[k].get("success", False)
        for k in ["redis_west", "redis_east", "kafka", "mirrormakers", "mongodb"]
    )
    results["success"] = overall
    results["duration_seconds"] = round(time.perf_counter() - started_at, 3)

    if overall:
        logger.info("reset.all.completed", duration_seconds=results["duration_seconds"])
    else:
        logger.error(
            "reset.all.failed",
            duration_seconds=results["duration_seconds"],
            redis_west_ok=results["redis_west"].get("success", False),
            redis_east_ok=results["redis_east"].get("success", False),
            kafka_ok=results["kafka"].get("success", False),
            mirrormakers_ok=results["mirrormakers"].get("success", False),
            mongodb_ok=results["mongodb"].get("success", False),
        )

    return results


def reset_for_suite_sequence(
    suite_name: str,
    namespace: str = "featbit",
    stabilization_seconds: int = 30,
    west_api_base_url: str = "https://featbit-api.west.local",
    east_api_base_url: str = "https://featbit-api.east.local",
    skip_certificate_check: bool = True,
    health_timeout_seconds: int = 120,
    health_poll_interval_seconds: int = 5,
    on_step=None,
) -> Dict[str, Any]:
    """Run deterministic reset sequence for suite execution.

    Sequence:
    1) scale down featbit api pods in east and west
    2) delete flags in MongoDB
    3) clear redis cache
    4) reset suite-specific Kafka topics in east and west
    5) restart MirrorMaker deployments

    6) verify redis readiness before api scale-up
    7) scale up featbit api pods in east and west
    8) wait for stabilization
    9) verify required health gates
    """
    started_at = time.perf_counter()
    logger.info(
        "reset.sequence.started",
        suite=suite_name,
        namespace=namespace,
        stabilization_seconds=stabilization_seconds,
        health_timeout_seconds=health_timeout_seconds,
        health_poll_interval_seconds=health_poll_interval_seconds,
    )

    contexts = ["west", "east"]
    results: Dict[str, Any] = {
        "suite": suite_name,
        "steps": [],
    }

    def _step(name: str, fn, *args, **kwargs):
        if on_step:
            on_step(name, "running")
        result = fn(*args, **kwargs)
        success = result.get("success", False) if isinstance(result, dict) else bool(result)
        if on_step:
            on_step(name, "ok" if success else "failed")
        return result

    api_scale_down = _step("api_scale_down", scale_down_api_pods, contexts, namespace)
    results["api_scale_down"] = api_scale_down
    results["steps"].append({"name": "api_scale_down", "success": api_scale_down.get("success", False)})
    if not api_scale_down.get("success", False):
        results["success"] = False
        results["duration_seconds"] = round(time.perf_counter() - started_at, 3)
        logger.error("reset.sequence.failed", step="api_scale_down", results=results)
        return results

    mongodb = _step("mongodb_delete_flags", reset_mongodb_flags, contexts, namespace)
    results["mongodb"] = mongodb
    results["steps"].append({"name": "mongodb_delete_flags", "success": mongodb.get("success", False)})
    if not mongodb.get("success", False):
        results["success"] = False
        results["duration_seconds"] = round(time.perf_counter() - started_at, 3)
        logger.error("reset.sequence.failed", step="mongodb_delete_flags", results=results)
        return results

    if on_step:
        on_step("redis_readiness", "running")
    redis_west_ready = ensure_redis_running("west", namespace)
    redis_east_ready = ensure_redis_running("east", namespace)
    results["redis_west_ready"] = redis_west_ready
    results["redis_east_ready"] = redis_east_ready
    redis_ready_success = redis_west_ready.get("success", False) and redis_east_ready.get("success", False)
    if on_step:
        on_step("redis_readiness", "ok" if redis_ready_success else "failed")
    results["steps"].append({"name": "redis_readiness", "success": redis_ready_success})
    if not redis_ready_success:
        results["success"] = False
        results["duration_seconds"] = round(time.perf_counter() - started_at, 3)
        logger.error("reset.sequence.failed", step="redis_readiness", results=results)
        return results

    if on_step:
        on_step("redis_flush", "running")
    redis_west = reset_redis("west", namespace)
    redis_east = reset_redis("east", namespace)
    results["redis_west"] = redis_west
    results["redis_east"] = redis_east
    redis_success = redis_west.get("success", False) and redis_east.get("success", False)
    if on_step:
        on_step("redis_flush", "ok" if redis_success else "failed")
    results["steps"].append({"name": "redis_flush", "success": redis_success})
    if not redis_success:
        results["success"] = False
        results["duration_seconds"] = round(time.perf_counter() - started_at, 3)
        logger.error("reset.sequence.failed", step="redis_flush", results=results)
        return results

    kafka_topics = topics_for_suite(suite_name)
    kafka = _step("kafka_topics_reset", reset_kafka_topics, contexts, namespace, topics=kafka_topics)
    results["kafka"] = kafka
    results["kafka_topics"] = kafka_topics
    results["steps"].append({"name": "kafka_topics_reset", "success": kafka.get("success", False)})
    if not kafka.get("success", False):
        results["success"] = False
        results["duration_seconds"] = round(time.perf_counter() - started_at, 3)
        logger.error("reset.sequence.failed", step="kafka_topics_reset", results=results)
        return results

    mirrormakers = _step("mirrormaker_restart", restart_mirrormakers, contexts, namespace)
    results["mirrormakers"] = mirrormakers
    results["steps"].append({"name": "mirrormaker_restart", "success": mirrormakers.get("success", False)})
    if not mirrormakers.get("success", False):
        results["success"] = False
        results["duration_seconds"] = round(time.perf_counter() - started_at, 3)
        logger.error("reset.sequence.failed", step="mirrormaker_restart", results=results)
        return results

    if on_step:
        on_step("redis_readiness_pre_api_scale_up", "running")
    redis_west_ready_pre_scale_up = ensure_redis_running("west", namespace)
    redis_east_ready_pre_scale_up = ensure_redis_running("east", namespace)
    results["redis_west_ready_pre_scale_up"] = redis_west_ready_pre_scale_up
    results["redis_east_ready_pre_scale_up"] = redis_east_ready_pre_scale_up
    redis_ready_pre_scale_up_success = redis_west_ready_pre_scale_up.get("success", False) and redis_east_ready_pre_scale_up.get("success", False)
    if on_step:
        on_step("redis_readiness_pre_api_scale_up", "ok" if redis_ready_pre_scale_up_success else "failed")
    results["steps"].append({"name": "redis_readiness_pre_api_scale_up", "success": redis_ready_pre_scale_up_success})
    if not redis_ready_pre_scale_up_success:
        results["success"] = False
        results["duration_seconds"] = round(time.perf_counter() - started_at, 3)
        logger.error("reset.sequence.failed", step="redis_readiness_pre_api_scale_up", results=results)
        return results

    api_scale_up = _step(
        "api_scale_up",
        scale_up_api_pods,
        api_scale_down.get("snapshots", {}),
        namespace,
    )
    results["api_scale_up"] = api_scale_up
    results["steps"].append({"name": "api_scale_up", "success": api_scale_up.get("success", False)})
    if not api_scale_up.get("success", False):
        results["success"] = False
        results["duration_seconds"] = round(time.perf_counter() - started_at, 3)
        logger.error("reset.sequence.failed", step="api_scale_up", results=results)
        return results

    if stabilization_seconds > 0:
        logger.info("reset.sequence.stabilizing", wait_seconds=stabilization_seconds)
        if on_step:
            on_step("stabilization_wait", "running")
        stabilization_started = time.perf_counter()
        time.sleep(stabilization_seconds)
        results["stabilization"] = {
            "success": True,
            "wait_seconds": stabilization_seconds,
            "duration_seconds": round(time.perf_counter() - stabilization_started, 3),
        }
        if on_step:
            on_step("stabilization_wait", "ok")
        results["steps"].append({"name": "stabilization_wait", "success": True})

    if on_step:
        on_step("health_verification", "running")
    health = verify_post_reset_health(
        west_api_base_url=west_api_base_url,
        east_api_base_url=east_api_base_url,
        skip_certificate_check=skip_certificate_check,
        contexts=contexts,
        namespace=namespace,
        health_timeout_seconds=health_timeout_seconds,
        health_poll_interval_seconds=health_poll_interval_seconds,
    )
    if on_step:
        on_step("health_verification", "ok" if health.get("success", False) else "failed")
    results["health"] = health
    results["steps"].append({"name": "health_verification", "success": health.get("success", False)})

    results["success"] = health.get("success", False)
    results["duration_seconds"] = round(time.perf_counter() - started_at, 3)
    if results["success"]:
        logger.info("reset.sequence.completed", duration_seconds=results["duration_seconds"])
    else:
        logger.error("reset.sequence.failed", step="health_verification", results=results)

    return results
