#!/usr/bin/env python3
"""Repoint the host proxy's load-balanced upstreams to a single active DC.

Edits ONLY the featbit_ui / featbit_api / featbit_eval upstream blocks in the
generated proxy config; per-cluster vhost server blocks are left untouched.
Then reloads nginx inside the featbit-proxy container.
"""
import subprocess, sys, os

active = sys.argv[1]  # "west" or "east"
CONF = os.path.expanduser("~/.featbit/proxy/nginx.conf")

WEST = {"8081", "15000", "5100", "5102", "5104", "5106", "5108"}
EAST = {"8082", "15001", "5101", "5103", "5105", "5107", "5109"}
inactive = EAST if active == "west" else WEST

import re
lines = open(CONF).read().split("\n")
out = []
in_lb = False
depth = 0
changed = 0
for ln in lines:
    s = ln.strip()
    if not in_lb and re.match(r"upstream\s+featbit_(ui|api|eval)\s*\{", s):
        in_lb = True
        depth = ln.count("{") - ln.count("}")
        out.append(ln); continue
    if in_lb:
        depth += ln.count("{") - ln.count("}")
        # comment server lines whose port belongs to the inactive DC
        m = re.search(r"server\s+127\.0\.0\.1:(\d+)", s)
        if m and m.group(1) in inactive and not s.startswith("#"):
            out.append(re.sub(r"(\s*)(server)", r"\1# SIM-DISABLED \2", ln, count=1)); changed += 1
        elif s.startswith("# SIM-DISABLED") and m and m.group(1) not in inactive:
            # re-enable a previously-disabled active-DC line
            out.append(ln.replace("# SIM-DISABLED ", "", 1)); changed += 1
        else:
            out.append(ln)
        if depth <= 0:
            in_lb = False
        continue
    out.append(ln)

open(CONF, "w").write("\n".join(out))
print(f"active DC = {active}; rewrote {changed} upstream server line(s)")
# validate + reload nginx in the container
r = subprocess.run(["docker", "exec", "featbit-proxy", "nginx", "-t"], capture_output=True, text=True)
print(r.stderr.strip().splitlines()[-1] if r.stderr else "")
if r.returncode != 0:
    print("nginx -t FAILED; not reloading"); sys.exit(1)
subprocess.run(["docker", "exec", "featbit-proxy", "nginx", "-s", "reload"], check=True)
print("nginx reloaded")
