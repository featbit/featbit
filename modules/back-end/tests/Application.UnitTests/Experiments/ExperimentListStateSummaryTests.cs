using Application.Experiments;
using Domain.Experiments;

namespace Application.UnitTests.Experiments;

public class ExperimentListStateSummaryTests
{
    [Theory]
    [InlineData(null, false)]
    [InlineData("", false)]
    [InlineData(" \t\n\r\u3000", false)]
    [InlineData(" A finding ", true)]
    public void From_DistinguishesLearningFromWhitespace(string? learning, bool expected)
    {
        var summary = ExperimentListStateSummaryVm.From(learning!,
        [
            new ExperimentRun { WhatChanged = learning! },
            new ExperimentRun { WhatHappened = learning! },
            new ExperimentRun { ConfirmedOrRefuted = learning! },
            new ExperimentRun { WhyItHappened = learning! },
            new ExperimentRun { NextHypothesis = learning! }
        ]);

        Assert.Equal(expected, summary.HasLearning);
        Assert.All(summary.Runs, run => Assert.Equal(expected, run.HasLearning));
    }

    [Fact]
    public void From_PreservesSeparateRunsAndObservationWindows()
    {
        var created = new DateTime(2026, 9, 1, 0, 0, 0, DateTimeKind.Utc);
        var older = new ExperimentRun
        {
            Id = Guid.NewGuid(), CreatedAt = created, Decision = "ROLLBACK",
            WhatHappened = "Older finding", ObservationEnd = created.AddDays(1)
        };
        var newer = new ExperimentRun
        {
            Id = Guid.NewGuid(), CreatedAt = created.AddDays(2),
            ObservationStart = created.AddDays(2), ObservationEnd = null
        };

        var summary = ExperimentListStateSummaryVm.From("Previous cycle", [newer, older]);

        Assert.True(summary.HasLearning);
        var latest = Assert.Single(summary.Runs, run => run.Id == newer.Id);
        Assert.Equal(newer.CreatedAt, latest.CreatedAt);
        Assert.Equal(newer.ObservationStart, latest.ObservationStart);
        Assert.Null(latest.ObservationEnd);
        Assert.Null(latest.Decision);
        Assert.False(latest.HasLearning);
        var previous = Assert.Single(summary.Runs, run => run.Id == older.Id);
        Assert.Equal("ROLLBACK", previous.Decision);
        Assert.True(previous.HasLearning);
        Assert.Equal(older.ObservationEnd, previous.ObservationEnd);
    }
}
