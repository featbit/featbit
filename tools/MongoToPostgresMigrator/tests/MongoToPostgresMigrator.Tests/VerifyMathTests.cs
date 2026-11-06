namespace MongoToPostgresMigrator.Tests;

public class VerifyMathTests
{
    // ---- CheckSourceGuard -------------------------------------------------

    [Fact]
    public void CheckSourceGuard_Stable_WhenCountUnchanged()
    {
        Assert.Equal(SourceGuard.Stable, VerifyMath.CheckSourceGuard(1000, 1000));
    }

    [Fact]
    public void CheckSourceGuard_Grew_WhenSourceIncreased()
    {
        // Growth means writes leaked in.
        Assert.Equal(SourceGuard.Grew, VerifyMath.CheckSourceGuard(1000, 1001));
    }

    [Fact]
    public void CheckSourceGuard_Shrank_WhenSourceDecreased()
    {
        // Shrink means rows were deleted mid-run.
        Assert.Equal(SourceGuard.Shrank, VerifyMath.CheckSourceGuard(1000, 999));
    }

    // ---- CheckCount -------------------------------------------------------

    [Fact]
    public void CheckCount_Ok_WhenTargetEqualsSourceMinusSkipped()
    {
        var r = VerifyMath.CheckCount(sourceNow: 1000, target: 993, skipped: 7);

        Assert.True(r.Ok);
        Assert.Equal(993, r.Expected);
    }

    [Fact]
    public void CheckCount_Ok_WithNoSkips()
    {
        var r = VerifyMath.CheckCount(sourceNow: 1000, target: 1000, skipped: 0);

        Assert.True(r.Ok);
        Assert.Equal(1000, r.Expected);
    }

    [Fact]
    public void CheckCount_Mismatch_WhenTargetShort()
    {
        var r = VerifyMath.CheckCount(sourceNow: 1000, target: 992, skipped: 7);

        Assert.False(r.Ok);
        Assert.Equal(993, r.Expected); // expected value the caller logs
    }

    [Fact]
    public void CheckCount_Mismatch_WhenTargetOverfull()
    {
        var r = VerifyMath.CheckCount(sourceNow: 1000, target: 994, skipped: 7);

        Assert.False(r.Ok);
        Assert.Equal(993, r.Expected);
    }
}
