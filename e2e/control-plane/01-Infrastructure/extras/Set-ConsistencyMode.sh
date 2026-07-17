#!/bin/bash
# Flip ConsistencyMode on both QA clusters (control-plane + evaluation-server) and wait.
mode=$1
for ctx in west east; do
  kubectl --context $ctx -n featbit set env deploy/control-plane "ControlPlane__ConsistencyMode=$mode" >/dev/null
  kubectl --context $ctx -n featbit set env deploy/evaluation-server "ControlPlane__ConsistencyMode=$mode" >/dev/null
done
for ctx in west east; do
  kubectl --context $ctx -n featbit rollout status deploy/control-plane --timeout=300s >/dev/null || exit 1
  kubectl --context $ctx -n featbit rollout status deploy/evaluation-server --timeout=300s >/dev/null || exit 1
done
sleep 15   # let evals reconnect, heartbeat (5s cadence), and leases re-form
echo "mode=$mode applied to west+east"
