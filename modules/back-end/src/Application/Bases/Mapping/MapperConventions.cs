using Application.Bases.Models;

namespace Application.Bases.Mapping;

/// <summary>
/// Collection rules shared by the view model mappers, matching how AutoMapper mapped them so API
/// responses keep their shape: a null collection maps to an empty one (it serializes as <c>[]</c>,
/// not <c>null</c>), and a mapped collection is always a new instance.
/// </summary>
public static class MapperConventions
{
    public static PagedResult<TTarget> MapPage<TSource, TTarget>(PagedResult<TSource> page, Func<TSource, TTarget> map) =>
        page == null ? null : new PagedResult<TTarget>(page.TotalCount, MapList(page.Items, map));

    public static List<TTarget> MapList<TSource, TTarget>(IEnumerable<TSource> source, Func<TSource, TTarget> map) =>
        source == null ? [] : source.Select(map).ToList();

    public static List<T> CopyList<T>(IEnumerable<T> source) => source == null ? [] : [.. source];

    public static T[] CopyArray<T>(IEnumerable<T> source) => source == null ? [] : [.. source];
}
