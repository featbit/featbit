namespace Api.Application.ControlPlane;

/// <summary>
/// #108 item 7: shared leader-gate guard for the three gated-commit workers
/// (<see cref="CommitCoordinatorWorker"/>, <see cref="RecoveryWorker"/>,
/// <see cref="DcIdConsistencyChecker"/>). Each worker's <c>RunOnceAsync</c> previously opened with
/// an identical "if (!IsLeader) { log Debug; return sentinel; }" gate (#71b) that differed only in
/// the logged worker name — this factors that check into one place.
/// </summary>
public static class LeaderElectionExtensions
{
    /// <summary>
    /// Returns <c>true</c> when this instance currently holds leadership and should run its tick.
    /// Returns <c>false</c> when it should skip — already logged at Debug (expected steady state on
    /// a non-leader replica, not a warning-worthy condition). Callers still return their OWN
    /// per-worker sentinel (<c>0</c> / <c>0</c> / <c>null</c>) at the call site, since that return
    /// shape is worker-specific.
    /// </summary>
    public static bool ShouldRunAsLeader(this ILeaderElection leaderElection, ILogger logger, string workerName)
    {
        if (leaderElection.IsLeader)
        {
            return true;
        }

        logger.LogDebug(
            "{WorkerName}: instance {InstanceId} is not leader; skipping tick.",
            workerName,
            leaderElection.InstanceId);
        return false;
    }
}
