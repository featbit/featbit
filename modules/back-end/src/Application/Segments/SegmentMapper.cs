using Application.Bases.Mapping;
using Application.Bases.Models;
using Domain.Segments;
using Riok.Mapperly.Abstractions;

namespace Application.Segments;

[Mapper]
public static partial class SegmentMapper
{
    public static partial SegmentVm ToVm(Segment segment);

    public static PagedResult<SegmentVm> ToVm(PagedResult<Segment> segments) => MapperConventions.MapPage(segments, ToVm);

    [UserMapping(Default = true)]
    private static ICollection<string> CopyScopes(string[] scopes) => MapperConventions.CopyList(scopes);

    [UserMapping(Default = true)]
    private static string[] CopyTags(string[] tags) => MapperConventions.CopyArray(tags);
}
