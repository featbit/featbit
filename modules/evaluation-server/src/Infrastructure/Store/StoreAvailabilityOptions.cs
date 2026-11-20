using System.ComponentModel.DataAnnotations;

namespace Infrastructure.Store;

/// <summary>
/// Settings of the <see cref="StoreAvailableSentinel"/>, bound from the <c>StoreAvailability</c> section.
/// </summary>
public sealed class StoreAvailabilityOptions
{
    public const string SectionName = "StoreAvailability";

    /// <summary>Seconds between the starts of two checks.</summary>
    [Range(1, 3600)]
    public int CheckIntervalSeconds { get; set; } = 6;

    /// <summary>How long one store may take to answer before its check counts as timed out.</summary>
    [Range(100, 60_000)]
    public int CheckTimeoutMilliseconds { get; set; } = 2000;

    /// <summary>
    /// Consecutive checks that must find the current store worse off before reads move to a lower-priority
    /// store: 12 to 18 seconds at the default interval.
    /// </summary>
    [Range(1, 100)]
    public int FailureThreshold { get; set; } = 3;

    /// <summary>
    /// Consecutive checks that must find a higher-priority store answering before reads move back to it.
    /// Higher than <see cref="FailureThreshold"/> on purpose: moving back to a store that is still unsteady
    /// is what makes reads bounce.
    /// </summary>
    [Range(1, 100)]
    public int RecoveryThreshold { get; set; } = 5;

    /// <summary>
    /// The least time between two changes of the store reads go to. The first change after startup is not
    /// delayed by it.
    /// </summary>
    [Range(0, 3600)]
    public int MinimumDwellSeconds { get; set; } = 60;
}
