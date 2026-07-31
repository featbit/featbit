#!/usr/bin/env python3
"""Provision FeatBit projects + realistic feature flags for the otel-demo components.

One FeatBit PROJECT per otel-demo component, each with 2-3 realistic, best-practice
flags (intention-revealing kebab-case names, single concern, safe default that
preserves current behavior). A few flags can take values that — if misconfigured —
surface application resiliency gaps (out-of-range number, unknown experiment
variant); those "bad" variations are created so QA can flip to them, but the
DEFAULT served value is always safe.

Provision against the ACTIVE datacenter's API (west); FeatBit's control plane
propagates flags + the environment's server SDK secret to both DCs.

Mirrors the proven API recipe in 02-Tests/automation-py/scripts/seed_data.py but
is self-contained (stdlib only): login-by-email -> profile -> org -> project ->
env -> server secret -> feature flags. Idempotent. Prints the server SDK secret.

Usage:
  python3 Provision-FeatBitFlags.py \
      --api http://featbit-api-west.127.0.0.1.sslip.io:8080 \
      --email test@featbit.com --password 123456 --org playground \
      [--component recommendation]   # default: all defined components
"""
import argparse
import json
import sys
import urllib.error
import urllib.request

API_VERSION = "1"


# --- Flag catalog: project (per component) -> flags -----------------------------
# variationType: boolean | number | string
# variations[0] is the safe DEFAULT (served when the flag is enabled).
COMPONENTS = {
    "recommendation": {
        "project_key": "otel-recommendation",
        "project_name": "otel-recommendation",
        "flags": [
            {
                "key": "recommendation-caching-enabled",
                "type": "boolean",
                "description": "Ops kill-switch for the in-memory product-catalog cache. "
                               "Safe either way; default ON preserves caching.",
                "variations": [("true", "true"), ("false", "false")],
                # default ON = caching enabled (safe, current behavior)
            },
            {
                "key": "recommendation-list-max-results",
                "type": "number",
                "description": "Cap on recommendations returned. Default 5. "
                               "Misconfiguring to a negative value surfaces a missing "
                               "input-validation gap (the service errors).",
                "variations": [("5", "5"), ("10", "10"), ("0", "0"), ("-1", "-1")],
            },
            {
                "key": "recommendation-ranking-strategy",
                "type": "string",
                "description": "Experiment: ranking strategy. Default 'popularity'. "
                               "An unrecognized variant surfaces an unknown-variant "
                               "handling gap (the service errors).",
                "variations": [
                    ("popularity", "popularity"),
                    ("random", "random"),
                    ("recent", "recent"),
                    ("experimental", "experimental"),  # not handled by the service -> error
                ],
            },
        ],
    },
    "ad": {
        "project_key": "otel-ad",
        "project_name": "otel-ad",
        "flags": [
            {
                "key": "ad-personalization-enabled",
                "type": "boolean",
                "description": "Release flag gating the (safe) personalized-ad code path / span "
                               "attributes. Safe either way; default OFF preserves current "
                               "non-personalized behavior.",
                "variations": [("false", "false"), ("true", "true")],
                # default OFF = no personalization (safe, current behavior)
            },
            {
                "key": "ad-max-count",
                "type": "number",
                "description": "Number of ads returned. Default 2. Applied without validation: "
                               "a negative or too-large value surfaces a missing input-validation "
                               "gap (subList out of range -> the service errors).",
                "variations": [("2", "2"), ("1", "1"), ("4", "4"), ("100", "100"), ("-1", "-1")],
                # 2 (default), 1, 4 safe; 100 too-large -> error; -1 negative -> error
            },
            {
                "key": "ad-category",
                "type": "string",
                "description": "Experiment: which ad category to serve. Default 'all'. An "
                               "unrecognized category surfaces an unknown-variant handling gap "
                               "(enum valueOf -> the service errors).",
                "variations": [
                    ("all", "all"),
                    ("telescopes", "telescopes"),
                    ("accessories", "accessories"),
                    ("binoculars", "binoculars"),
                    ("premium", "premium"),  # not a real category -> error
                ],
            },
        ],
    },
    "product-catalog": {
        "project_key": "otel-product-catalog",
        "project_name": "otel-product-catalog",
        "flags": [
            {
                "key": "catalog-extra-latency-ms",
                "type": "number",
                "description": "Config: artificial latency (ms) added to product lookups. "
                               "Default 0. Applied verbatim (no validation).",
                "variations": [("0", "0"), ("250", "250"), ("5000", "5000"), ("-1", "-1")],
            },
            {
                "key": "catalog-pricing-promo-enabled",
                "type": "boolean",
                "description": "Release flag gating a promotional pricing code path / span "
                               "attribute. Safe either way; default OFF.",
                "variations": [("false", "false"), ("true", "true")],
            },
            {
                "key": "catalog-list-max-products",
                "type": "number",
                "description": "Config: cap on products returned (0 = all). Default 0. Applied "
                               "without lower-bound validation: a negative value surfaces a gap "
                               "(slice out of range -> the service errors).",
                "variations": [("0", "0"), ("5", "5"), ("-1", "-1")],
            },
        ],
    },
    "cart": {
        "project_key": "otel-cart",
        "project_name": "otel-cart",
        "flags": [
            {
                "key": "cart-persistence-enabled",
                "type": "boolean",
                "description": "Ops kill-switch for the Valkey-backed cart store. Safe either "
                               "way; default ON preserves persistence.",
                "variations": [("true", "true"), ("false", "false")],
            },
            {
                "key": "cart-max-items",
                "type": "number",
                "description": "Config: max items accepted by AddItem. Default 100. Applied "
                               "without lower-bound validation: a negative value surfaces a gap "
                               "(the service errors).",
                "variations": [("100", "100"), ("5", "5"), ("-1", "-1")],
            },
            {
                "key": "cart-readonly-mode",
                "type": "boolean",
                "description": "Ops flag: when ON, AddItem is cleanly rejected (deliberate "
                               "feature, not a crash). Default OFF.",
                "variations": [("false", "false"), ("true", "true")],
            },
        ],
    },
    "payment": {
        "project_key": "otel-payment",
        "project_name": "otel-payment",
        "flags": [
            {
                "key": "payment-fraud-check-enabled",
                "type": "boolean",
                "description": "Ops flag gating the (simulated) fraud-check step. Safe either "
                               "way; default ON.",
                "variations": [("true", "true"), ("false", "false")],
            },
            {
                "key": "payment-retry-attempts",
                "type": "number",
                "description": "Config: retry attempts on a simulated transient failure. Default "
                               "0. Applied without validation: a negative value errors "
                               "(RangeError), an absurd value surfaces a broken loop.",
                "variations": [("0", "0"), ("1", "1"), ("2", "2"), ("3", "3"),
                               ("-1", "-1"), ("1000000000000", "1000000000000")],
            },
            {
                "key": "payment-provider",
                "type": "string",
                "description": "Experiment: payment provider path. Default 'default'. An "
                               "unrecognized provider surfaces an unknown-variant gap "
                               "(undefined handler -> the service errors).",
                "variations": [
                    ("default", "default"),
                    ("visa-direct", "visa-direct"),
                    ("braintree", "braintree"),
                    ("stripe", "stripe"),  # no handler -> error
                ],
            },
        ],
    },
    "accounting": {
        "project_key": "otel-accounting",
        "project_name": "otel-accounting",
        "flags": [
            {"key": "operational-ledger-persistence-enabled", "type": "boolean",
             "description": "Ops kill-switch for writing ledger entries. Safe either way; default ON.",
             "variations": [("true", "true"), ("false", "false")]},
            {"key": "release-double-entry-bookkeeping", "type": "boolean",
             "description": "Release gate for the new double-entry bookkeeping path. Default OFF.",
             "variations": [("false", "false"), ("true", "true")]},
            {"key": "experiment-currency-rounding", "type": "string",
             "description": "A/B currency rounding strategy. Default 'bankers'. Unknown value -> error.",
             "variations": [("bankers", "bankers"), ("half-up", "half-up"),
                            ("truncate", "truncate"), ("midpoint", "midpoint")]},  # midpoint unhandled -> error
        ],
    },
    "checkout": {
        "project_key": "otel-checkout",
        "project_name": "otel-checkout",
        "flags": [
            {"key": "operational-checkout-enabled", "type": "boolean",
             "description": "Master ops kill-switch for checkout. Default ON; OFF returns a clean 'unavailable'.",
             "variations": [("true", "true"), ("false", "false")]},
            {"key": "release-express-checkout", "type": "boolean",
             "description": "Release gate for express/one-click checkout. Default OFF.",
             "variations": [("false", "false"), ("true", "true")]},
            {"key": "experiment-shipping-cost-strategy", "type": "string",
             "description": "A/B shipping cost strategy. Default 'standard'. Unknown value -> error.",
             "variations": [("standard", "standard"), ("flat-rate", "flat-rate"),
                            ("free-over-threshold", "free-over-threshold"), ("dynamic", "dynamic")]},  # dynamic unhandled -> error
        ],
    },
    "fraud-detection": {
        "project_key": "otel-fraud-detection",
        "project_name": "otel-fraud-detection",
        "flags": [
            {"key": "operational-fraud-checks-enabled", "type": "boolean",
             "description": "Ops kill-switch for fraud scoring. Default ON; OFF approves all (degraded).",
             "variations": [("true", "true"), ("false", "false")]},
            {"key": "release-ml-fraud-model-v2", "type": "boolean",
             "description": "Release gate for the v2 ML fraud model. Default OFF.",
             "variations": [("false", "false"), ("true", "true")]},
            {"key": "experiment-fraud-risk-threshold", "type": "number",
             "description": "A/B risk threshold 0-100. Default 80. Out-of-range (negative / >100) -> error.",
             "variations": [("80", "80"), ("60", "60"), ("95", "95"), ("150", "150"), ("-1", "-1")]},  # 150/-1 out of range -> error
        ],
    },
    "llm": {
        "project_key": "otel-llm",
        "project_name": "otel-llm",
        "flags": [
            {"key": "operational-ai-assistant-enabled", "type": "boolean",
             "description": "Ops kill-switch for the AI assistant (cost/outage control). Default ON.",
             "variations": [("true", "true"), ("false", "false")]},
            {"key": "release-streaming-responses", "type": "boolean",
             "description": "Release gate for streaming LLM responses. Default OFF.",
             "variations": [("false", "false"), ("true", "true")]},
            {"key": "experiment-llm-model", "type": "string",
             "description": "A/B model selection. Default 'default'. Unknown model -> error.",
             "variations": [("default", "default"), ("fast", "fast"),
                            ("accurate", "accurate"), ("gpt-5", "gpt-5")]},  # gpt-5 unknown -> error
        ],
    },
    "frontend": {
        "project_key": "otel-frontend",
        "project_name": "otel-frontend",
        "flags": [
            {"key": "release-redesigned-product-page", "type": "boolean",
             "description": "Release gate for the redesigned product page. Default OFF.",
             "variations": [("false", "false"), ("true", "true")]},
            {"key": "operational-recommendations-enabled", "type": "boolean",
             "description": "Ops toggle to show/hide the recommendations section. Default ON.",
             "variations": [("true", "true"), ("false", "false")]},
            {"key": "experiment-checkout-button-variant", "type": "string",
             "description": "A/B checkout button variant. Default 'control'. Unknown variant -> error.",
             "variations": [("control", "control"), ("variant-a", "variant-a"),
                            ("variant-b", "variant-b"), ("variant-x", "variant-x")]},  # variant-x unhandled -> error
        ],
    },
}


class Api:
    def __init__(self, base, token=None):
        self.base = base.rstrip("/")
        self.headers = {"Content-Type": "application/json"}
        if token:
            self.headers["Authorization"] = f"Bearer {token}"

    def _req(self, method, path, body=None):
        url = f"{self.base}{path}"
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method, headers=self.headers)
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                raw = r.read().decode()
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"{method} {path} -> {e.code}: {e.read().decode()[:300]}")
        if not raw:
            return {}
        doc = json.loads(raw)
        # Management API wraps payloads as {success, data, errors}
        return doc.get("data", doc) if isinstance(doc, dict) else doc

    def get(self, p):
        return self._req("GET", p)

    def post(self, p, b):
        return self._req("POST", p, b)

    def put(self, p, b):
        return self._req("PUT", p, b)


def find(items, key, name=None):
    items = items if isinstance(items, list) else ([items] if items else [])
    for it in items:
        if isinstance(it, dict) and it.get("key") == key:
            return it
    if name:
        for it in items:
            if isinstance(it, dict) and it.get("name") == name:
                return it
    return None


def resolve_secret(api, env_id, env_obj):
    """Return the server SDK secret value for an environment, creating one if absent."""
    secrets = (env_obj or {}).get("secrets") or []
    server = next((s for s in secrets if str(s.get("type", "")).lower() == "server"), None)
    if not server:
        # Fetch fresh env detail in case the create payload omitted secrets.
        try:
            detail = api.get(f"/api/v{API_VERSION}/envs/{env_id}")
            secrets = detail.get("secrets") or secrets
            server = next((s for s in secrets if str(s.get("type", "")).lower() == "server"), None)
        except RuntimeError:
            pass
    if not server:
        server = api.post(f"/api/v{API_VERSION}/envs/{env_id}/secrets",
                          {"envId": env_id, "name": "otel-demo-server", "type": "server"})
    return (server or {}).get("value")


def ensure_flag(api, env_id, spec):
    flags_ep = f"/api/v{API_VERSION}/envs/{env_id}/feature-flags"
    key = spec["key"]
    try:
        existing = api.get(f"{flags_ep}/{key}")
        if existing and existing.get("id"):
            return key, "exists"
    except RuntimeError:
        pass
    variations = [{"id": f"{key}-{n}", "name": n, "value": v} for (n, v) in spec["variations"]]
    default_var = variations[0]["id"]
    off_var = variations[0]["id"]  # serve the safe default even when the flag is OFF
    payload = {
        "name": key,
        "key": key,
        "description": spec.get("description", ""),
        "isEnabled": True,                  # enabled -> serves the safe default variation
        "variationType": spec["type"],
        "variations": variations,
        "enabledVariationId": default_var,
        "disabledVariationId": off_var,
        "tags": ["otel-demo"],
    }
    api.post(flags_ep, payload)
    return key, "created"


def provision_component(api, comp_name, comp, org_id, workspace_id):
    # project
    projects = api.get(f"/api/v{API_VERSION}/projects")
    project = find(projects, comp["project_key"], comp["project_name"])
    if not project:
        project = api.post(f"/api/v{API_VERSION}/projects",
                           {"organizationId": org_id, "name": comp["project_name"], "key": comp["project_key"]})
    project_id = project.get("id")

    # environment (reuse default 'prod'/'dev' if present, else create 'prod')
    envs = project.get("environments") or []
    env = envs[0] if envs else None
    if not env:
        try:
            env = api.get(f"/api/v{API_VERSION}/projects/{project_id}/envs/by-key/prod")
        except RuntimeError:
            env = api.post(f"/api/v{API_VERSION}/projects/{project_id}/envs",
                           {"name": "Prod", "key": "prod", "description": "otel-demo"})
    env_id = env.get("id")

    secret = resolve_secret(api, env_id, env)
    results = [ensure_flag(api, env_id, f) for f in comp["flags"]]
    return {
        "component": comp_name,
        "project_key": comp["project_key"],
        "project_id": project_id,
        "env_id": env_id,
        "server_secret": secret,
        "flags": results,
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--api", required=True, help="Active DC API base, e.g. http://featbit-api-west.127.0.0.1.sslip.io:8080")
    ap.add_argument("--email", default="test@featbit.com")
    ap.add_argument("--password", default="123456")
    ap.add_argument("--org", default="playground")
    ap.add_argument("--component", default=None, help="Only this component (default: all)")
    args = ap.parse_args()

    # login
    login = Api(args.api).post(f"/api/v{API_VERSION}/identity/login-by-email",
                               {"email": args.email, "password": args.password})
    token = login.get("token") or login.get("accessToken")
    if not token:
        print("ERROR: login did not return a token", file=sys.stderr)
        sys.exit(1)
    api = Api(args.api, token)

    # Resolve workspace (the /organizations endpoint is workspace-scoped, and the
    # bearer token only carries the user id — so the Workspace header is required).
    workspaces = api.get(f"/api/v{API_VERSION}/user/workspaces")
    if not workspaces:
        print("ERROR: user has no workspaces", file=sys.stderr)
        sys.exit(1)
    workspace_id = (workspaces[0] if isinstance(workspaces, list) else workspaces).get("id")
    api.headers["Workspace"] = workspace_id

    # org
    orgs = api.get(f"/api/v{API_VERSION}/organizations")
    org = find(orgs, args.org, args.org)
    if not org:
        print(f"ERROR: organization '{args.org}' not found in workspace {workspace_id}", file=sys.stderr)
        sys.exit(1)
    org_id = org.get("id")
    api.headers["Organization"] = org_id
    if not org.get("initialized"):
        try:
            api.post(f"/api/v{API_VERSION}/organizations/{org_id}/onboarding", {})
        except RuntimeError:
            pass

    comps = {args.component: COMPONENTS[args.component]} if args.component else COMPONENTS
    results = [provision_component(api, name, c, org_id, workspace_id)
               for name, c in comps.items()]
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
