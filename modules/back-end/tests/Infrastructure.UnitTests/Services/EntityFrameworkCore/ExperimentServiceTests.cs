using Service = Infrastructure.Services.EntityFrameworkCore.ExperimentService;

namespace Infrastructure.UnitTests.Services.EntityFrameworkCore;

public class ExperimentServiceTests
{
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
    [MemberData(nameof(NumericComparisons))]
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
        var section = Analyze(-10, -9.99, 4, false, prior: new Service.GaussianPrior(priorMean, 0.0001, true));
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

    private static Dictionary<string, object?> Analyze(double control, double treatment, double variance,
        bool inverse, bool guardrail = false, Service.GaussianPrior? prior = null) =>
        Service.ComputeMetricSection("numeric", new Dictionary<string, object>
        {
            ["inverse"] = inverse,
            ["control"] = new Dictionary<string, object> { ["n"] = 1000, ["mean"] = control, ["variance"] = variance },
            ["treatment"] = new Dictionary<string, object> { ["n"] = 1000, ["mean"] = treatment, ["variance"] = variance }
        }, "control", ["treatment"], guardrail, prior, "average")!;

    private static Dictionary<string, object?> Treatment(Dictionary<string, object?> section) =>
        Assert.IsType<List<Dictionary<string, object?>>>(section["rows"]).Single(x => Equals(x["variant"], "treatment"));
}
