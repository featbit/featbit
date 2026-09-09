namespace UiExperimentData;

public sealed record ExactExposure(string UserKey, string VariationId, bool Value, DateTimeOffset At,
    string Kind = "", string Reason = "");
public sealed record ExactTrack(string UserKey, string MetricKey, double Value);

/// <summary>Pure selection logic: actual evaluation outcomes determine membership; no SDK calls or I/O.</summary>
public static class ExactBinaryPlan
{
    public const string Version = "exact-binary-2000-v1";
    public const string FlagKey = "e2e-scenario-balanced";
    public const string BinaryKey = "binary-primary-metric";
    public const string CountKey = "numeric-count-all-guarail-metric";
    public const string SumKey = "numeric-sum-guarail-metric";
    public const int UserCount = 2000;

    // Distribution/A are unused adapters for existing metric metadata. This plan never calls Generator.Values.
    public static Scenario Scenario => new("exact-binary-2000", "e2e-bayesian-binary-primary", FlagKey,
        "boolean", ["false", "true"], UserCount, 0, 0, false, null, 0, 100,
        [
            new(BinaryKey, "binary", "once", "increase_good", "once", [0, 0]),
            new(CountKey, "numeric", "count", "increase_bad", "poisson", [0, 0]),
            new(SumKey, "numeric", "sum", "increase_bad", "sum", [0, 0])
        ]);

    public static string[] NewUsers()
    {
        var users = Enumerable.Range(0, UserCount).Select(_ => Guid.NewGuid().ToString("D")).ToArray();
        ValidateUsers(users);
        return users;
    }

    public static void ValidateUsers(string[] users)
    {
        if (users is null || users.Length != UserCount)
            throw new Stop($"Exactly {UserCount} UUID users are required.");
        if (users.Any(user => !Guid.TryParseExact(user, "D", out var id) || id == Guid.Empty || user != id.ToString("D")))
            throw new Stop("Every user key must be a non-empty, lowercase UUID in canonical D format.");
        if (users.Distinct(StringComparer.Ordinal).Count() != UserCount)
            throw new Stop("The 2000 UUID users must be distinct.");
    }

    public static List<ExactTrack> Select(IReadOnlyList<ExactExposure> exposures)
    {
        if (exposures is null || exposures.Any(exposure => exposure is null))
            throw new Stop("An actual evaluation result is required for every UUID user.");
        ValidateUsers(exposures.Select(exposure => exposure.UserKey).ToArray());
        if (exposures.Any(exposure => string.IsNullOrWhiteSpace(exposure.VariationId)))
            throw new Stop("Every evaluation must include its actual variation ID.");

        var trueUsers = exposures.Where(exposure => exposure.Value).ToArray();
        var falseUsers = exposures.Where(exposure => !exposure.Value).ToArray();
        if (trueUsers.Length < 153 || falseUsers.Length < 100)
            throw new Stop($"Insufficient actual outcomes: true={trueUsers.Length} (need 153), false={falseUsers.Length} (need 100). No extra users or evaluations are allowed.");

        // Take the first N users within each actual outcome, preserving evaluation order.
        // The same user may participate in more than one metric.
        var tracks = new List<ExactTrack>(671);
        foreach (var user in trueUsers.Take(153)) tracks.Add(new(user.UserKey, BinaryKey, 1));
        foreach (var user in falseUsers.Take(88)) tracks.Add(new(user.UserKey, BinaryKey, 1));

        for (var index = 0; index < 100; index++)
        {
            for (var call = 0; call < (index < 20 ? 2 : 1); call++)
                tracks.Add(new(trueUsers[index].UserKey, CountKey, 1));
            for (var call = 0; call < (index < 10 ? 3 : 2); call++)
                tracks.Add(new(falseUsers[index].UserKey, CountKey, 1));
        }

        for (var index = 0; index < 50; index++)
        {
            tracks.Add(new(trueUsers[index].UserKey, SumKey, index == 0 ? 25 : 24));
            tracks.Add(new(falseUsers[index].UserKey, SumKey, index < 10 ? 45 : 44));
        }
        return tracks;
    }
}
