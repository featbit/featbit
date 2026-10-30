using Domain.AuditLogs;
using Domain.FlagRevisions;

namespace MongoToPostgresMigrator.Tests;

/// <summary>
/// Unit tests for <see cref="MigrationPipeline.Build"/>: the wiring is declared
/// exactly once and reused by preflight, migrate, and verify, so these checks
/// guard the entity count, uniqueness, parents-first ordering, and which tables
/// use the binary-COPY write path.
/// </summary>
public class MigrationPipelineTests
{
    private static IReadOnlyList<IEntityStep> CreateSut() => MigrationPipeline.Build(copyBatchSize: 50_000);

    [Fact]
    public void Build_ProducesTheExpected29Steps()
    {
        var steps = CreateSut();

        Assert.Equal(29, steps.Count);
    }

    [Fact]
    public void Build_StepNamesAreUnique()
    {
        var names = CreateSut().Select(s => s.Name).ToList();

        Assert.Equal(names.Count, names.Distinct().Count());
    }

    [Fact]
    public void Build_HighVolumeTablesUseCopySteps()
    {
        var byName = CreateSut().ToDictionary(s => s.Name);

        Assert.IsType<EndUserCopyStep>(byName["EndUsers"]);
        Assert.IsType<BulkCopyStep<AuditLog>>(byName["AuditLogs"]);
        Assert.IsType<BulkCopyStep<FlagRevision>>(byName["FlagRevisions"]);
    }

    [Fact]
    public void Build_OrdinaryTablesUseTheEfStep()
    {
        var byName = CreateSut().ToDictionary(s => s.Name);

        Assert.IsType<EntityStep<Domain.Users.User>>(byName["Users"]);
        Assert.IsType<EntityStep<Domain.Workspaces.Workspace>>(byName["Workspaces"]);
    }

    [Theory]
    // logical parents must be copied before their children so an aborted run is
    // never left referentially broken.
    [InlineData("Organizations", "Projects")]
    [InlineData("Projects", "Environments")]
    [InlineData("Workspaces", "Users")]
    [InlineData("EndUserProperties", "EndUsers")]
    public void Build_OrdersParentsBeforeChildren(string parent, string child)
    {
        var names = CreateSut().Select(s => s.Name).ToList();

        Assert.True(names.IndexOf(parent) < names.IndexOf(child),
            $"'{parent}' should be migrated before '{child}'.");
    }

    [Fact]
    public void Build_StartsAtWorkspaceRoot()
    {
        var steps = CreateSut();

        Assert.Equal("Workspaces", steps[0].Name);
    }

    [Fact]
    public void Build_WithNoExclusions_KeepsAll29Steps()
    {
        var steps = MigrationPipeline.Build(50_000, exclude: new HashSet<string>());

        Assert.Equal(29, steps.Count);
    }

    [Fact]
    public void Build_ExcludesNamedEntities_AndKeepsTheRestInOrder()
    {
        var full = CreateSut().Select(s => s.Name).ToList();
        var exclude = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "EndUsers", "AuditLogs" };

        var steps = MigrationPipeline.Build(50_000, exclude);
        var names = steps.Select(s => s.Name).ToList();

        Assert.DoesNotContain("EndUsers", names);
        Assert.DoesNotContain("AuditLogs", names);
        Assert.Equal(full.Count - 2, names.Count);
        // Remaining steps keep their original relative order.
        Assert.Equal(full.Where(n => n is not ("EndUsers" or "AuditLogs")).ToList(), names);
    }

    [Fact]
    public void Build_ExclusionIsCaseInsensitive()
    {
        // Deliberately the default (ordinal) comparer: Build must apply
        // case-insensitive matching itself rather than inheriting it from the
        // caller's set, which is the documented contract.
        var exclude = new HashSet<string> { "endusers" };

        var names = MigrationPipeline.Build(50_000, exclude).Select(s => s.Name).ToList();

        Assert.DoesNotContain("EndUsers", names);
    }

    [Fact]
    public void Build_UnknownExclusionName_HasNoEffect()
    {
        var exclude = new HashSet<string>(StringComparer.OrdinalIgnoreCase) { "NotAnEntity" };

        var steps = MigrationPipeline.Build(50_000, exclude);

        Assert.Equal(29, steps.Count);
    }

    [Fact]
    public void KnownEntityNames_MatchesTheBuiltPipeline_CaseInsensitively()
    {
        var built = CreateSut().Select(s => s.Name);

        Assert.Equal(29, MigrationPipeline.KnownEntityNames.Count);
        Assert.All(built, n => Assert.Contains(n, MigrationPipeline.KnownEntityNames));
        Assert.Contains("endusers", MigrationPipeline.KnownEntityNames);
    }
}
