using Domain.Shared;
using Microsoft.Extensions.Diagnostics.HealthChecks;

namespace Infrastructure.Store;

/// <summary>
/// Diagnostic check reporting which <see cref="IDbStore"/> the eval server is CURRENTLY serving
/// from, and whether that is its highest-priority store or a fallback.
/// </summary>
/// <remarks>
/// <para>
/// Failover is the eval server's most consequential silent state change: when the primary store
/// stops answering, <see cref="StoreAvailableSentinel"/> quietly switches to the next store in
/// priority order and the pod keeps serving. Nothing in liveness or readiness distinguishes that
/// pod from a fully healthy one, so an operator investigating stale flag values has no way to
/// tell — from the pod itself — that it is reading from a fallback.
/// </para>
/// <para>
/// The check performs NO I/O. It reads the sentinel's last decision, which is refreshed every six
/// seconds by the existing background loop, so polling this endpoint cannot add load to a store
/// that is already struggling — the exact moment this check matters most.
/// </para>
/// <para>
/// Diagnostics-tagged only. A pod on its fallback store is still correctly serving traffic, so
/// this must never gate readiness; reporting <c>Degraded</c> here is informational.
/// </para>
/// </remarks>
public sealed class StoreAvailabilityHealthCheck : IHealthCheck
{
    private readonly string[] _storesByPriority;

    public StoreAvailabilityHealthCheck(IEnumerable<IDbStore> dbStores)
    {
        // Same ordering rule as StoreAvailableSentinel (see Stores.cs): stores are ordered by name
        // and the first is the highest priority. Duplicating the rule rather than sharing it would
        // let the two disagree about which store is "primary".
        _storesByPriority = dbStores.Select(x => x.Name).Order(StringComparer.Ordinal).ToArray();
    }

    public Task<HealthCheckResult> CheckHealthAsync(
        HealthCheckContext context,
        CancellationToken cancellationToken = default)
    {
        var available = StoreAvailabilityListener.Instance.AvailableStore;
        var primary = _storesByPriority.FirstOrDefault() ?? string.Empty;

        var data = new Dictionary<string, object>
        {
            ["available_store"] = string.IsNullOrEmpty(available) ? "none" : available,
            ["primary_store"] = string.IsNullOrEmpty(primary) ? "none" : primary,
            ["stores_by_priority"] = string.Join(",", _storesByPriority),
            ["is_failed_over"] = !string.IsNullOrEmpty(available) && available != primary
        };

        if (string.IsNullOrEmpty(available))
        {
            return Task.FromResult(HealthCheckResult.Unhealthy(
                "No store has been reported available yet.", data: data));
        }

        if (available != primary)
        {
            return Task.FromResult(HealthCheckResult.Degraded(
                $"Serving from fallback store '{available}'; the primary store is '{primary}'.",
                data: data));
        }

        return Task.FromResult(HealthCheckResult.Healthy(
            $"Serving from the primary store '{available}'.", data));
    }
}
