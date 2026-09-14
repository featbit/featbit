using Application.Bases;
using Application.Bases.Exceptions;
using Application.Experiments;
using Domain.Experiments;

namespace Application.UnitTests.Experiments;

public class ExperimentRunAllocationTests
{
    [Theory]
    [InlineData(1, 10, 10, 20, 0, false)]
    [InlineData(1, 10, 5, 20, 0, true)]
    [InlineData(1, 10, 5, 20, 30, false)]
    [InlineData(1, null, 10, 20, 0, true)]
    [InlineData(10, 20, 1, null, 0, true)]
    [InlineData(10, null, 20, null, 0, true)]
    public void ValidateReservation_RequiresTimeAndBucketOverlap(
        int start, int? end, int otherStart, int? otherEnd, double otherBucketStart, bool conflicts)
    {
        var run = Run(start, end);
        var candidate = Run(otherStart, otherEnd);
        candidate.SliceStart = otherBucketStart;
        candidate.SliceEnd = otherBucketStart + 30;

        var exception = Record.Exception(() => ExperimentRunAllocation.ValidateReservation(run, [candidate]));

        if (conflicts)
            Assert.Equal(ErrorCodes.Conflict, Assert.IsType<BusinessException>(exception).Message);
        else
            Assert.Null(exception);
    }

    [Fact]
    public void ValidateReservation_SameExperimentCanReuseBuckets()
    {
        var first = Run(1, null);
        var second = Run(5, 10);
        second.ExperimentId = first.ExperimentId;
        ExperimentRunAllocation.ValidateReservation(first, [second]);
    }

    [Fact]
    public void ValidateReservation_CanonicalIdsOverrideStaleKeys()
    {
        var first = Run(1, null);
        var second = Run(5, 10);
        first.LayerId = second.LayerId = Guid.NewGuid();
        second.LayerKey = "old-key";
        Assert.Throws<BusinessException>(() => ExperimentRunAllocation.ValidateReservation(first, [second]));

        second.LayerId = Guid.NewGuid();
        second.LayerKey = first.LayerKey;
        ExperimentRunAllocation.ValidateReservation(first, [second]);
    }

    [Fact]
    public void NormalizeAndValidateWindow_BackfillsStableCreationTime()
    {
        var run = Run(1, 10);
        run.CreatedAt = run.ObservationStart!.Value;
        run.ObservationStart = null;
        ExperimentRunAllocation.NormalizeAndValidateWindow(run);
        Assert.Equal(run.CreatedAt, run.ObservationStart);
    }

    [Fact]
    public void ValidateReservation_LegacyInvalidWindowMustBeRepaired()
    {
        var run = Run(1, 10);
        var legacy = Run(1, 10);
        legacy.ObservationStart = null;
        legacy.CreatedAt = legacy.ObservationEnd!.Value.AddDays(1);
        Assert.Throws<BusinessException>(() => ExperimentRunAllocation.ValidateReservation(run, [legacy]));
    }

    [Theory]
    [InlineData(1)]
    [InlineData(2)]
    public void NormalizeAndValidateWindow_RejectsEmptyAndReversedWindows(int startDay)
    {
        Assert.Throws<BusinessException>(() => ExperimentRunAllocation.NormalizeAndValidateWindow(Run(startDay, 1)));
    }

    private static ExperimentRun Run(int start, int? end) => new()
    {
        Id = Guid.NewGuid(),
        ExperimentId = Guid.NewGuid(),
        LayerKey = "checkout",
        SliceStart = 0,
        SliceEnd = 30,
        Decision = "CONTINUE",
        ObservationStart = Day(start),
        ObservationEnd = end.HasValue ? Day(end.Value) : null
    };

    private static DateTime Day(int day) => new(2026, 9, day, 0, 0, 0, DateTimeKind.Utc);
}
