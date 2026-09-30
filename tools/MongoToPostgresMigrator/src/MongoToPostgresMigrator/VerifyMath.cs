namespace MongoToPostgresMigrator;

/// <summary>
/// Result of the post-run source-count guard for a single entity. The source is
/// expected to be frozen for the run, so any change is a failure.
/// </summary>
public enum SourceGuard
{
    /// <summary>Source count is unchanged since preflight — the expected frozen-source case.</summary>
    Stable,

    /// <summary>Source grew — new writes leaked in; a failure.</summary>
    Grew,

    /// <summary>Source shrank — rows were deleted mid-run; a failure.</summary>
    Shrank
}

/// <summary>The target-count decision plus the expected value used to reach it.</summary>
public readonly record struct CountResult(bool Ok, long Expected);

/// <summary>
/// Pure decision logic for the verify pass. Kept free of any database or
/// logging dependency so the count arithmetic can be unit-tested directly.
/// </summary>
public static class VerifyMath
{
    /// <summary>
    /// Classifies the change in the source count between preflight
    /// (<paramref name="sourceBefore"/>) and the post-run recount
    /// (<paramref name="sourceNow"/>). The source must be frozen for the run, so
    /// either growth or shrink is a failure.
    /// </summary>
    public static SourceGuard CheckSourceGuard(long sourceBefore, long sourceNow)
    {
        if (sourceNow > sourceBefore)
        {
            return SourceGuard.Grew;
        }

        if (sourceNow < sourceBefore)
        {
            return SourceGuard.Shrank;
        }

        return SourceGuard.Stable;
    }

    /// <summary>
    /// Decides whether the target count is acceptable. The target must hold every
    /// source row except those explicitly skipped for violating a target
    /// constraint, i.e. <c>target == sourceNow - skipped</c>.
    /// </summary>
    public static CountResult CheckCount(long sourceNow, long target, long skipped)
    {
        var expected = sourceNow - skipped;
        return new CountResult(target == expected, expected);
    }
}
