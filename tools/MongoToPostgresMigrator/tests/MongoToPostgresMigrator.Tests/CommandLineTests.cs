namespace MongoToPostgresMigrator.Tests;

/// <summary>
/// Unit tests for argv handling. The tool runs during a production cutover where
/// the only switch decides between a read-only rehearsal and writing to
/// PostgreSQL, so anything that is not exactly <c>--dry-run</c> must be rejected
/// rather than ignored — an ignored <c>--dryrun</c> typo would perform a real
/// migration.
/// </summary>
public class CommandLineTests
{
    [Fact]
    public void NoArguments_AreAccepted()
    {
        Assert.Empty(Program.UnrecognizedArguments([]));
    }

    [Theory]
    [InlineData("--dry-run")]
    [InlineData("--DRY-RUN")]
    [InlineData("--Dry-Run")]
    public void DryRunSwitch_IsAccepted_CaseInsensitively(string arg)
    {
        Assert.Empty(Program.UnrecognizedArguments([arg]));
    }

    [Theory]
    [InlineData("--dryrun")]
    [InlineData("-dry-run")]
    [InlineData("--dry-run=true")]
    [InlineData("--dry_run")]
    [InlineData("--verify-only")]
    [InlineData("Migrator__BatchSize=500")]
    public void NearMissOrUnknownArgument_IsReported(string arg)
    {
        var unrecognized = Program.UnrecognizedArguments([arg]);

        Assert.Equal(arg, Assert.Single(unrecognized));
    }

    [Fact]
    public void EveryUnrecognizedArgument_IsReported_EvenAlongsideAValidSwitch()
    {
        var unrecognized = Program.UnrecognizedArguments(["--dry-run", "--force", "extra"]);

        Assert.Equal(["--force", "extra"], unrecognized);
    }
}
