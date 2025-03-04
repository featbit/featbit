namespace Domain.Segments;

public static class SegmentConsts
{
    public const string IsInSegment = "User is in segment";

    public const string IsNotInSegment = "User is not in segment";

    public static readonly string[] ConditionProperties = [IsInSegment, IsNotInSegment];
}