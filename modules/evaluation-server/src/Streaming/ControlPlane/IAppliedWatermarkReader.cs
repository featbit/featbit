namespace Streaming.ControlPlane;

/// <summary>
/// Computes the applied watermark per environment from the local DC Redis — the shared,
/// authoritative serving state — rather than from per-pod in-memory stream-processing progress.
/// The watermark for an env is the maximum committed score in that env's Redis flag index
/// (<c>featbit:flag-index:{envId}</c>), i.e. the latest committed flag version this DC's Redis
/// holds. Because all pods in a DC read the same Redis, they all report the same value, and a
/// freshly started pod is immediately correct (no cold-start divergence).
/// </summary>
/// <remarks>
/// This does NOT gate commits; the commit gate is the control plane's responsibility. The
/// reported value is used by the heartbeat to express how far this DC is serving for each env
/// (for liveness / self-fence / recovery / metrics). Scope is flags only; segments can be
/// folded in later by also reading the segment index.
/// </remarks>
public interface IAppliedWatermarkReader
{
    /// <summary>
    /// Returns the applied watermark per environment, keyed by environment id. The watermark is
    /// the maximum committed score in the env's Redis flag index. Environments are determined
    /// from the pod's active connections; if none can be enumerated, the implementation scans the
    /// Redis flag-index keyspace. Environments with no committed flags are omitted.
    /// </summary>
    Task<Dictionary<Guid, long>> ReadAsync(CancellationToken cancellationToken = default);
}
