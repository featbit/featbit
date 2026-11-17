using System.Text.Json;

namespace Infrastructure.UnitTests.Services;

// Run the same data and assertions against each provider's production implementation.
public abstract class ExperimentServiceTestsBase
{
    protected abstract Dictionary<string, object?>? ComputeMetricSection(
        string label, Dictionary<string, object> metricData, string control,
        string[] treatments, bool isGuardrail, Prior? prior, string? metricAgg);

    public static IEnumerable<object[]> NumericComparisons()
    {
        (double control, double treatment)[] pairs = [(-10, -5), (-10, -15), (-10, 5), (-10, -10),
            (10, 15), (10, 5), (10, -5), (10, 10)];
        foreach (var (control, treatment) in pairs)
        foreach (var variance in new[] { 0d, 4d })
        foreach (var inverse in new[] { false, true })
            yield return [control, treatment, variance, inverse];
    }

    [Theory]
    [MemberData(nameof(NumericComparisons), MemberType = typeof(ExperimentServiceTestsBase))]
    public void ComputeMetricSection_NumericBaseline_UsesAbsoluteDirectionAndSignedRelativePresentation(
        double control, double treatment, double variance, bool inverse)
    {
        var section = Analyze(control, treatment, variance, inverse);
        var row = Treatment(section);
        var chance = control == treatment ? 0.5 : treatment > control ? 1d : 0d;
        if (inverse) chance = 1 - chance;
        var relative = (treatment - control) / control;

        Assert.Equal(chance, Assert.IsType<double>(row["p_win"]), 6);
        Assert.Equal(relative, Assert.IsType<double>(row["rel_delta"]), 6);
        Assert.True(Assert.IsType<double>(row["ci_lower"]) <= relative);
        Assert.True(Assert.IsType<double>(row["ci_upper"]) >= relative);
        var riskControl = Assert.IsType<double>(row["risk_ctrl"]);
        var riskTreatment = Assert.IsType<double>(row["risk_trt"]);
        Assert.True(double.IsFinite(riskControl) && riskControl >= 0);
        Assert.True(double.IsFinite(riskTreatment) && riskTreatment >= 0);
        if (chance > 0.5) Assert.True(riskControl > riskTreatment);
        else if (chance < 0.5) Assert.True(riskTreatment > riskControl);
        else Assert.Equal(riskControl, riskTreatment, 6);
        if (variance == 0) Assert.Equal(Math.Abs(relative), Math.Max(riskControl, riskTreatment), 6);
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void ComputeMetricSection_NegativeBaselineGuardrail_ReportsHarmInMetricDirection(bool inverse)
    {
        var section = Analyze(-10, -5, 4, inverse, guardrail: true);
        var row = Treatment(section);

        Assert.Equal(inverse ? 1d : 0d, Assert.IsType<double>(row["p_harm"]), 6);
        Assert.Contains(inverse ? "ALARM" : "clear", Assert.IsType<string>(section["verdict"]));
    }

    [Theory]
    [InlineData(-0.5, 1)]
    [InlineData(0.5, 0)]
    public void ComputeMetricSection_NegativeBaselineRelativePrior_PreservesPriorUnitsAndCorrectDirection(
        double priorMean, double chance)
    {
        var section = Analyze(-10, -9.99, 4, false, prior: new Prior(priorMean, 0.0001, true));
        var row = Treatment(section);

        Assert.Equal(chance, Assert.IsType<double>(row["p_win"]), 6);
        Assert.Equal(Math.Sign(priorMean), Math.Sign(Assert.IsType<double>(row["rel_delta"])));
    }

    [Theory]
    [InlineData(false)]
    [InlineData(true)]
    public void ComputeMetricSection_OverlappingNegativeMeans_ReportsUncertainDirection(bool inverse)
    {
        var row = Treatment(Analyze(-10, -9.99, 4, inverse));
        var chance = Assert.IsType<double>(row["p_win"]);

        Assert.InRange(inverse ? 1 - chance : chance, 0.52, 0.57);
        Assert.Equal(-0.001, Assert.IsType<double>(row["rel_delta"]), 6);
    }

    [Theory]
    [InlineData(-10, 1)]
    [InlineData(-10, 3)]
    [InlineData(10, 1)]
    [InlineData(10, 3)]
    public void ComputeMetricSection_EqualUncertainMeans_ReportsNormalizedNormalExpectedLoss(double mean, double scale)
    {
        // With n=1000 and variance=5 in each arm, the relative SE is exactly 0.01.
        // A centered normal's one-sided expected loss is SE / sqrt(2*pi).
        var row = Treatment(Analyze(mean * scale, mean * scale, 5 * scale * scale, false));
        var expectedRisk = 0.01 / Math.Sqrt(2 * Math.PI);

        Assert.Equal(expectedRisk, Assert.IsType<double>(row["risk_ctrl"]), 6);
        Assert.Equal(expectedRisk, Assert.IsType<double>(row["risk_trt"]), 6);
        Assert.Equal(0.5, Assert.IsType<double>(row["p_win"]), 6);
    }

    [Theory]
    [InlineData(-10, -9.99)]
    [InlineData(10, 10.01)]
    public void ComputeMetricSection_MetricUnitsRescaled_PreservesNormalizedRisk(double control, double treatment)
    {
        var original = Treatment(Analyze(control, treatment, 4, false));
        var scaled = Treatment(Analyze(control * 3, treatment * 3, 4 * 9, false));

        Assert.Equal(Assert.IsType<double>(original["risk_ctrl"]), Assert.IsType<double>(scaled["risk_ctrl"]), 6);
        Assert.Equal(Assert.IsType<double>(original["risk_trt"]), Assert.IsType<double>(scaled["risk_trt"]), 6);
        Assert.Equal(Assert.IsType<double>(original["p_win"]), Assert.IsType<double>(scaled["p_win"]), 6);
        Assert.True(Assert.IsType<double>(original["risk_ctrl"]) > 0);
        Assert.True(Assert.IsType<double>(original["risk_trt"]) > 0);
    }

    [Fact]
    public void ComputeMetricSection_ZeroBaseline_OmitsUndefinedRelativeInference()
    {
        var section = Analyze(0, 5, 4, false);
        var row = Treatment(section);

        Assert.False(row.ContainsKey("rel_delta"));
        Assert.False(row.ContainsKey("p_win"));
        Assert.False(row.ContainsKey("risk_ctrl"));
        Assert.Equal("no data", section["verdict"]);
    }

    public static IEnumerable<object[]> MetricDirections()
    {
        foreach (var inverse in new[] { false, true })
        foreach (var guardrail in new[] { false, true })
        foreach (var jsonElements in new[] { false, true })
            yield return [inverse, guardrail, jsonElements];
    }

    public static IEnumerable<object[]> AggregateFormats()
    {
        foreach (var aggregation in new[] { "sum", "count", "average" })
        foreach (var direction in MetricDirections())
            yield return [aggregation, ..direction];
    }

    // Positive-control reference values were captured from the pre-fix commit
    // 5fa58d8c5afe7974b108e9d2a4e77727048d3203 in both production providers.
    [Theory]
    [MemberData(nameof(AggregateFormats), MemberType = typeof(ExperimentServiceTestsBase))]
    public void ComputeMetricSection_PositiveAggregates_MatchesPreFixResults(
        string aggregation, bool inverse, bool guardrail, bool jsonElements)
    {
        var section = AnalyzeMetricData(new Dictionary<string, object>
        {
            ["control"] = Aggregate(40, 12.5, 25),
            ["near"] = Aggregate(60, 13.75, 36),
            ["worse"] = Aggregate(23, 8, 64)
        }, ["near", "worse"], inverse, guardrail, aggregation, jsonElements);
        var verdict = guardrail
            ? inverse ? "near: guardrail inconclusive - monitor; worse: guardrail clear"
                : "near: guardrail inconclusive - monitor; worse: guardrail ALARM - likely regression"
            : inverse ? "near: leaning control; worse: strong signal -> adopt treatment"
                : "near: leaning treatment; worse: treatment appears harmful";
        var rows = AssertSection(section, false, inverse, aggregation, verdict);

        Assert.Equal(3, rows.Count);
        AssertVariant(rows[0], "control", 40, 12.5, false, true);
        AssertVariant(rows[1], "near", 60, 13.75, false);
        AssertVariant(rows[2], "worse", 23, 8, false);
        AssertInference(rows[1], inverse, guardrail, .8584, .1, -.082603, .282603, .106737, .006737);
        AssertInference(rows[2], inverse, guardrail, .0049, -.36, -.633323, -.086677, .000216, .360216);
    }

    [Theory]
    [MemberData(nameof(MetricDirections), MemberType = typeof(ExperimentServiceTestsBase))]
    public void ComputeMetricSection_BinaryUnequalSamples_MatchesPreFixResults(
        bool inverse, bool guardrail, bool jsonElements)
    {
        var section = AnalyzeMetricData(new Dictionary<string, object>
        {
            ["control"] = new Dictionary<string, object> { ["n"] = 200L, ["k"] = 80L },
            ["near"] = new Dictionary<string, object> { ["n"] = 170L, ["k"] = 70L },
            ["worse"] = new Dictionary<string, object> { ["n"] = 500L, ["k"] = 160L }
        }, ["near", "worse"], inverse, guardrail, "once", jsonElements);
        var verdict = guardrail
            ? inverse ? "near: guardrail inconclusive - monitor; worse: guardrail inconclusive - monitor"
                : "near: guardrail inconclusive - monitor; worse: guardrail ALARM - likely regression"
            : inverse ? "near: inconclusive; worse: strong signal -> adopt treatment"
                : "near: inconclusive; worse: treatment appears harmful";
        var rows = AssertSection(section, true, inverse, "once", verdict);

        Assert.Equal(3, rows.Count);
        AssertVariant(rows[0], "control", 200, .4, true, true, 80);
        AssertVariant(rows[1], "near", 170, .411765, true, conversions: 70);
        AssertVariant(rows[2], "worse", 500, .32, true, conversions: 160);
        AssertInference(rows[1], inverse, guardrail, .5896, .029412, -.225026, .283850, .067819, .038407);
        AssertInference(rows[2], inverse, guardrail, .0105, -.2, -.369964, -.030036, .000312, .200312);
    }

    [Theory]
    [InlineData(false, .6702, .05, -.172528, .272528, .074617, .024617, "inconclusive")]
    [InlineData(true, 0, -.143981, -.182586, -.105376, 0, .143981, "treatment appears harmful")]
    public void ComputeMetricSection_PositiveBaselinePrior_MatchesPreFixResults(bool proper,
        double pWin, double relative, double lower, double upper, double riskControl, double riskTreatment,
        string verdict)
    {
        var section = AnalyzeMetricData(new Dictionary<string, object>
        {
            ["control"] = Aggregate(40, 10, 25),
            ["treatment"] = Aggregate(60, 10.5, 36)
        }, ["treatment"], prior: new Prior(-.15, .0004, proper));
        var rows = AssertSection(section, false, false, "average", verdict);

        Assert.Equal(2, rows.Count);
        AssertVariant(rows[0], "control", 40, 10, false, true);
        AssertVariant(rows[1], "treatment", 60, 10.5, false);
        AssertInference(rows[1], false, false, pWin, relative, lower, upper, riskControl, riskTreatment);
    }

    public static IEnumerable<object?[]> UncertainNegativePosteriors()
    {
        // Independent normal-distribution references for means=(-10,-9.5),
        // n=(40,60), variances=(25,36). Loss = sigma*phi(z)+mu*Phi(z),
        // normalized by |control mean|; these are not outputs from the PR.
        (double? priorMean, double priorVariance, double pWin, double relative,
            double lower, double upper, double riskControl, double riskTreatment)[] expectations =
        [
            (null, 1, .6785, -.05, -.261464, .161464, .072584, .022584),
            (0, .09, .6686, -.044274, -.243260, .154713, .066431, .022157),
            (-.1, .01, .8528, -.076895, -.220643, .066853, .082463, .005567),
            (.15, .0004, 0, .143356, .104813, .181898, 0, .143356)
        ];
        foreach (var inverse in new[] { false, true })
        foreach (var guardrail in new[] { false, true })
        foreach (var e in expectations)
            yield return [inverse, guardrail, e.priorMean, e.priorVariance,
                e.pWin, e.relative, e.lower, e.upper, e.riskControl, e.riskTreatment];
    }

    [Theory]
    [MemberData(nameof(UncertainNegativePosteriors), MemberType = typeof(ExperimentServiceTestsBase))]
    public void ComputeMetricSection_UncertainNegativeAggregates_MatchesIndependentPosterior(
        bool inverse, bool guardrail, double? priorMean, double priorVariance,
        double pWin, double relative, double lower, double upper, double riskControl, double riskTreatment)
    {
        var section = AnalyzeMetricData(new Dictionary<string, object>
        {
            ["control"] = Aggregate(40, -10, 25),
            ["treatment"] = Aggregate(60, -9.5, 36)
        }, ["treatment"], inverse, guardrail,
            prior: priorMean.HasValue ? new Prior(priorMean.Value, priorVariance, true) : null);

        AssertInference(Treatment(section), inverse, guardrail,
            pWin, relative, lower, upper, riskControl, riskTreatment);
    }

    public static IEnumerable<object[]> VerdictCases()
    {
        (double mean, double relative, double lower, double upper, double pWin,
            double riskControl, double riskTreatment, string primary, string guardrail)[] expectations =
        [
            (7.6, -.24, -.435996, -.044004, .0082, .000272, .240272, "treatment appears harmful", "guardrail ALARM - likely regression"),
            (8.3, -.17, -.365996, .025996, .0446, .001829, .171829, "treatment appears harmful", "guardrail ALARM - likely regression"),
            (9.1, -.09, -.285996, .105996, .1841, .010043, .100043, "leaning control", "guardrail inconclusive - monitor"),
            (10, 0, -.195996, .195996, .5, .039894, .039894, "inconclusive", "guardrail inconclusive - monitor"),
            (10.9, .09, -.105996, .285996, .8159, .100043, .010043, "leaning treatment", "guardrail inconclusive - monitor"),
            (11.7, .17, -.025996, .365996, .9554, .171829, .001829, "strong signal -> adopt treatment", "guardrail inconclusive - monitor"),
            (12.4, .24, .044004, .435996, .9918, .240272, .000272, "strong signal -> adopt treatment", "guardrail clear")
        ];
        for (var i = 0; i < expectations.Length; i++)
        foreach (var inverse in new[] { false, true })
        foreach (var guardrail in new[] { false, true })
        {
            var e = expectations[i];
            var decision = expectations[inverse ? expectations.Length - 1 - i : i];
            yield return [e.mean, e.relative, e.lower, e.upper, e.pWin, e.riskControl, e.riskTreatment,
                inverse, guardrail, guardrail ? decision.guardrail : decision.primary];
        }
    }

    [Theory]
    [MemberData(nameof(VerdictCases), MemberType = typeof(ExperimentServiceTestsBase))]
    public void ComputeMetricSection_PositiveBaselineVerdicts_MatchesPreFixResults(double mean,
        double relative, double lower, double upper, double pWin, double riskControl, double riskTreatment,
        bool inverse, bool guardrail, string verdict)
    {
        var section = AnalyzeMetricData(new Dictionary<string, object>
        {
            ["control"] = Aggregate(100, 10, 0),
            ["treatment"] = Aggregate(100, mean, 100)
        }, ["treatment"], inverse, guardrail);
        var rows = AssertSection(section, false, inverse, "average", verdict);

        Assert.Equal(2, rows.Count);
        AssertVariant(rows[0], "control", 100, 10, false, true);
        AssertVariant(rows[1], "treatment", 100, mean, false);
        AssertInference(rows[1], inverse, guardrail, pWin, relative, lower, upper, riskControl, riskTreatment);
    }

    [Theory]
    [InlineData("numeric-zero-control-n")]
    [InlineData("numeric-zero-treatment-n")]
    [InlineData("numeric-zero-control-mean")]
    [InlineData("binary-zero-control-n")]
    [InlineData("binary-zero-treatment-n")]
    [InlineData("binary-zero-control-rate")]
    [InlineData("missing-control")]
    [InlineData("missing-treatment")]
    public void ComputeMetricSection_MissingData_MatchesPreFixOmissions(string scenario)
    {
        var binary = scenario.StartsWith("binary", StringComparison.Ordinal);
        var data = new Dictionary<string, object>
        {
            ["control"] = binary ? new Dictionary<string, object> { ["n"] = 40L, ["k"] = 10L } : Aggregate(40, 10, 25),
            ["treatment"] = binary ? new Dictionary<string, object> { ["n"] = 60L, ["k"] = 20L } : Aggregate(60, 10.5, 36)
        };
        switch (scenario)
        {
            case "numeric-zero-control-n": case "binary-zero-control-n":
                ((Dictionary<string, object>)data["control"])["n"] = 0L;
                break;
            case "numeric-zero-treatment-n": case "binary-zero-treatment-n":
                ((Dictionary<string, object>)data["treatment"])["n"] = 0L;
                break;
            case "numeric-zero-control-mean": case "binary-zero-control-rate":
                ((Dictionary<string, object>)data["control"])[binary ? "k" : "sum"] = 0d;
                break;
            default:
                data.Remove(scenario == "missing-control" ? "control" : "treatment");
                break;
        }
        var section = AnalyzeMetricData(data, ["treatment"], aggregation: binary ? "once" : "average");

        Assert.Equal("no data", section["verdict"]);
        Assert.Equal(binary ? "proportion" : "numeric", section["metric_type"]);
        foreach (var key in new[] { "rel_delta", "ci_lower", "ci_upper", "p_win", "p_harm", "risk_ctrl", "risk_trt" })
            Assert.False(Treatment(section).ContainsKey(key));
    }

    [Theory]
    [InlineData(0, 0, -1, 1)]
    [InlineData(60, .5, 0, 0)]
    public void ComputeMetricSection_DeterministicBinary_MatchesPreFixResults(
        long conversions, double pWin, double relative, double riskTreatment)
    {
        var section = AnalyzeMetricData(new Dictionary<string, object>
        {
            ["control"] = new Dictionary<string, object> { ["n"] = 40L, ["k"] = 40L },
            ["treatment"] = new Dictionary<string, object> { ["n"] = 60L, ["k"] = conversions }
        }, ["treatment"], aggregation: "once");

        AssertVariant(Treatment(section), "treatment", 60, conversions == 0 ? 0 : 1, true, conversions: conversions);
        AssertInference(Treatment(section), false, false, pWin, relative, relative, relative, 0, riskTreatment);
    }

    private static Dictionary<string, object> Aggregate(long n, double mean, double variance) => new()
    {
        ["n"] = n, ["sum"] = n * mean, ["sum_squares"] = n * mean * mean + (n - 1) * variance
    };

    private Dictionary<string, object?> AnalyzeMetricData(Dictionary<string, object> data, string[] treatments,
        bool inverse = false, bool guardrail = false, string aggregation = "average", bool jsonElements = false,
        Prior? prior = null)
    {
        data["inverse"] = inverse;
        if (jsonElements) data = JsonSerializer.Deserialize<Dictionary<string, object>>(JsonSerializer.Serialize(data))!;
        return ComputeMetricSection("metric", data, "control", treatments, guardrail, prior, aggregation)!;
    }

    private static List<Dictionary<string, object?>> AssertSection(Dictionary<string, object?> section,
        bool binary, bool inverse, string aggregation, string verdict)
    {
        Assert.Equal(inverse ? 6 : 5, section.Count);
        Assert.Equal("metric", section["event"]);
        Assert.Equal(binary ? "proportion" : "numeric", section["metric_type"]);
        Assert.Equal(aggregation, section["metric_agg"]);
        Assert.Equal(inverse, Equals(section.GetValueOrDefault("inverse"), true));
        Assert.Equal(verdict, section["verdict"]);
        return Assert.IsType<List<Dictionary<string, object?>>>(section["rows"]);
    }

    private static void AssertVariant(Dictionary<string, object?> row, string variant, long n,
        double value, bool binary, bool control = false, long conversions = 0)
    {
        Assert.Equal((binary ? 5 : 4) + (control ? 0 : 6), row.Count);
        Assert.Equal(variant, row["variant"]);
        Assert.Equal(n, Assert.IsType<long>(row["n"]));
        Assert.Equal(control, Assert.IsType<bool>(row["is_control"]));
        Assert.Equal(value, Assert.IsType<double>(row[binary ? "rate" : "mean"]), 6);
        if (binary) Assert.Equal(conversions, Assert.IsType<long>(row["conversions"]));
    }

    private static void AssertInference(Dictionary<string, object?> row, bool inverse, bool guardrail,
        double pWin, double relative, double lower, double upper, double riskControl, double riskTreatment)
    {
        var chance = inverse ? 1 - pWin : pWin;
        Assert.Equal(guardrail ? 1 - chance : chance,
            Assert.IsType<double>(row[guardrail ? "p_harm" : "p_win"]), 4);
        Assert.False(row.ContainsKey(guardrail ? "p_win" : "p_harm"));
        Assert.Equal(relative, Assert.IsType<double>(row["rel_delta"]), 6);
        Assert.Equal(lower, Assert.IsType<double>(row["ci_lower"]), 6);
        Assert.Equal(upper, Assert.IsType<double>(row["ci_upper"]), 6);
        Assert.Equal(inverse ? riskTreatment : riskControl, Assert.IsType<double>(row["risk_ctrl"]), 6);
        Assert.Equal(inverse ? riskControl : riskTreatment, Assert.IsType<double>(row["risk_trt"]), 6);
    }

    private Dictionary<string, object?> Analyze(double control, double treatment, double variance,
        bool inverse, bool guardrail = false, Prior? prior = null) =>
        ComputeMetricSection("numeric", new Dictionary<string, object>
        {
            ["inverse"] = inverse,
            ["control"] = new Dictionary<string, object> { ["n"] = 1000, ["mean"] = control, ["variance"] = variance },
            ["treatment"] = new Dictionary<string, object> { ["n"] = 1000, ["mean"] = treatment, ["variance"] = variance }
        }, "control", ["treatment"], guardrail, prior, "average")!;

    private static Dictionary<string, object?> Treatment(Dictionary<string, object?> section) =>
        Assert.IsType<List<Dictionary<string, object?>>>(section["rows"]).Single(x => Equals(x["variant"], "treatment"));

    protected sealed record Prior(double Mean, double Variance, bool Proper);
}
