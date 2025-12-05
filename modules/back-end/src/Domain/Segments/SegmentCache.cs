namespace Domain.Segments;

public record SegmentCache(ICollection<Guid> EnvIds, Segment Segment);