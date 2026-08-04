namespace Domain.ControlPlane;

/// <summary>
/// Controls how the control plane propagates changes across data centers.
/// </summary>
public enum ConsistencyMode
{
    /// <summary>
    /// Today's behavior: changes are propagated without cross-DC gating (fire-and-forget).
    /// </summary>
    BestEffort,

    /// <summary>
    /// Changes are gated on cross-DC commit before being applied. Opt-in per deployment.
    /// </summary>
    GatedCommit
}