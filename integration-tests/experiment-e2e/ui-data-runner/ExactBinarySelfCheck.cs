namespace UiExperimentData;

/// <summary>Offline contract checks. No SDK, network, database, or event delivery.</summary>
public static class ExactBinarySelfCheck
{
    public static void Run()
    {
        var generated = ExactBinaryPlan.NewUsers();
        Require(generated.Length == 2000 && generated.Distinct().Count() == 2000, "2000 unique generated users");
        Require(generated.All(user => Guid.TryParseExact(user, "D", out var id) && id != Guid.Empty && user == id.ToString("D")), "canonical UUID users");
        var duplicate = (string[])generated.Clone();
        duplicate[1] = duplicate[0];
        Reject(() => ExactBinaryPlan.ValidateUsers(duplicate), "duplicate UUID");
        foreach (var invalid in new[] { "not-a-uuid", "", Guid.Empty.ToString("D"), generated[0].Replace("-", ""), "AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA" })
        {
            var malformed = (string[])generated.Clone();
            malformed[0] = invalid;
            Reject(() => ExactBinaryPlan.ValidateUsers(malformed), "malformed/noncanonical UUID");
        }
        Reject(() => ExactBinaryPlan.ValidateUsers(generated[..1999]), "1999 users");
        Reject(() => ExactBinaryPlan.ValidateUsers([.. generated, Guid.NewGuid().ToString("D")]), "2001 users");

        CheckSelection(Fixture(973));
        CheckSelection(Fixture(973).Reverse().ToArray());
        CheckSelection(Fixture(153));
        CheckSelection(Fixture(1900));
        CheckLedger();
        Reject(() => ExactBinaryPlan.Select(Fixture(152)), "only 152 true users");
        Reject(() => ExactBinaryPlan.Select(Fixture(1901)), "only 99 false users");
        var badExposure = Fixture(973);
        badExposure[1] = badExposure[1] with { UserKey = badExposure[0].UserKey };
        Reject(() => ExactBinaryPlan.Select(badExposure), "duplicate exposure user");
        badExposure = Fixture(973);
        badExposure[0] = badExposure[0] with { VariationId = " " };
        Reject(() => ExactBinaryPlan.Select(badExposure), "missing actual variation ID");
        Console.WriteLine("Exact binary offline self-check passed: UUID validation, actual-outcome quotas, evaluation-order selection, 671 track calls, six exact metric totals, and 2000-sample ledger denominators including users without metric events. No data injected.");
    }

    private static ExactExposure[] Fixture(int trueCount) => Enumerable.Range(0, 2000)
        .OrderBy(index => index * 997 % 2000)
        .Select(index => new ExactExposure($"00000000-0000-4000-8000-{index + 1:D12}",
            index < trueCount ? "true-variation" : "false-variation", index < trueCount, DateTimeOffset.UnixEpoch))
        .ToArray();

    private static void CheckSelection(ExactExposure[] exposures)
    {
        var tracks = ExactBinaryPlan.Select(exposures);
        var actual = exposures.ToDictionary(exposure => exposure.UserKey);
        // Literal expectations are independent of the plan's constants and implementation.
        (string Metric, bool Outcome, int Users, int Calls, double Sum)[] expected =
        [
            ("binary-primary-metric", true, 153, 153, 153),
            ("binary-primary-metric", false, 88, 88, 88),
            ("numeric-count-all-guarail-metric", true, 100, 120, 120),
            ("numeric-count-all-guarail-metric", false, 100, 210, 210),
            ("numeric-sum-guarail-metric", true, 50, 50, 1201),
            ("numeric-sum-guarail-metric", false, 50, 50, 2210)
        ];
        Require(tracks.Count == 671, "671 total track calls");
        Require(tracks.All(track => actual.ContainsKey(track.UserKey)), "every metric user was evaluated");
        Require(tracks.All(track => expected.Any(row => row.Metric == track.MetricKey)), "only three requested metric keys");
        foreach (var row in expected)
        {
            var selected = tracks.Where(track => track.MetricKey == row.Metric && actual[track.UserKey].Value == row.Outcome).ToArray();
            Require(selected.Length == row.Calls, $"{row.Metric}/{row.Outcome}: event count");
            Require(selected.Select(track => track.UserKey).Distinct().Count() == row.Users, $"{row.Metric}/{row.Outcome}: distinct user count");
            Require(selected.Sum(track => track.Value) == row.Sum, $"{row.Metric}/{row.Outcome}: value sum");
            var firstUsers = exposures.Where(exposure => exposure.Value == row.Outcome).Take(row.Users).Select(exposure => exposure.UserKey);
            Require(selected.Select(track => track.UserKey).Distinct().SequenceEqual(firstUsers), $"{row.Metric}/{row.Outcome}: first users in actual evaluation order");
        }
        Require(tracks.Where(track => track.MetricKey != "numeric-sum-guarail-metric").All(track => track.Value == 1), "binary and count track values are 1");
        Require(tracks.SequenceEqual(ExactBinaryPlan.Select(exposures)), "selection is deterministic");
    }

    private static void CheckLedger()
    {
        var scenario = ExactBinaryPlan.Scenario;
        var exposures = Fixture(973);
        var tracks = ExactBinaryPlan.Select(exposures).ToLookup(track => track.UserKey);
        var start = DateTimeOffset.UnixEpoch;
        var records = exposures.Select(exposure => new UserRecord
        {
            UserKey = exposure.UserKey,
            Phase = "exact-binary-self-check",
            Exposures = [new(scenario.Id, exposure.VariationId, exposure.Value ? "true" : "false", exposure.At, true)],
            Metrics = tracks[exposure.UserKey].Select(track => new MetricCall(track.MetricKey, track.Value, start.AddSeconds(1))).ToList()
        }).ToArray();
        Require(records.Count(record => record.Metrics.Count == 0) == 1747, "1747 exposed users have no metric events");
        Dictionary<string, string> ids = new() { ["false"] = "false-variation", ["true"] = "true-variation" };
        var stats = Ledger.Aggregate(scenario, ids, records, start, start.AddSeconds(2));

        // All exposed users remain in every metric's denominator, regardless of whether they track it.
        (string Metric, string Variation, long Users, long Conversions, double Sum, double SumSquares)[] expected =
        [
            ("binary-primary-metric", "true-variation", 973, 153, 153, 153),
            ("binary-primary-metric", "false-variation", 1027, 88, 88, 88),
            ("numeric-count-all-guarail-metric", "true-variation", 973, 100, 120, 160),
            ("numeric-count-all-guarail-metric", "false-variation", 1027, 100, 210, 450),
            ("numeric-sum-guarail-metric", "true-variation", 973, 50, 1201, 28849),
            ("numeric-sum-guarail-metric", "false-variation", 1027, 50, 2210, 97690)
        ];
        foreach (var row in expected)
        {
            var actual = stats[row.Metric][row.Variation];
            var name = $"ledger {row.Metric}/{row.Variation}";
            Require(actual.Users == row.Users, name + ": all exposed users in Samples denominator");
            Require(actual.Conversions == row.Conversions, name + ": distinct users with metric events");
            Require(actual.Sum == row.Sum, name + ": aggregate sum");
            Require(actual.SumSquares == row.SumSquares, name + ": sum of squared per-user contributions");
            Require(actual.Mean == row.Sum / row.Users, name + ": mean uses exposed users including zeros");
        }
        Require(stats.Values.All(variations => variations.Values.Sum(stat => stat.Users) == 2000), "each metric retains all 2000 samples");
    }

    private static void Require(bool condition, string name)
    {
        if (!condition) throw new Stop("Exact binary self-check failed: " + name);
    }

    private static void Reject(Action action, string name)
    {
        try { action(); }
        catch (Stop) { return; }
        throw new Stop("Exact binary self-check failed: accepted " + name);
    }
}
