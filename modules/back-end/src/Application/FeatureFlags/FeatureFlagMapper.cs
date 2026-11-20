using Application.Bases.Mapping;
using Application.Bases.Models;
using Domain.FeatureFlags;
using Riok.Mapperly.Abstractions;

namespace Application.FeatureFlags;

[Mapper]
public static partial class FeatureFlagMapper
{
    // The creator and the last change are looked up and attached by GetFeatureFlagListHandler.
    [MapperIgnoreTarget(nameof(FeatureFlagVm.Creator))]
    [MapperIgnoreTarget(nameof(FeatureFlagVm.LastChange))]
    [MapPropertyFromSource(nameof(FeatureFlagVm.Serves), Use = nameof(GetServes))]
    public static partial FeatureFlagVm ToVm(FeatureFlag flag);

    public static PagedResult<FeatureFlagVm> ToVm(PagedResult<FeatureFlag> flags) =>
        MapperConventions.MapPage(flags, ToVm);

    // A flag whose targeting collections are missing maps without serves instead of failing,
    // as it did with AutoMapper's MapFrom.
    private static Serves GetServes(FeatureFlag flag)
    {
        try
        {
            return flag.Serves();
        }
        catch (Exception ex) when (ex is NullReferenceException or ArgumentNullException)
        {
            return null;
        }
    }

    [UserMapping(Default = true)]
    private static ICollection<Variation> CopyVariations(ICollection<Variation> variations) =>
        MapperConventions.CopyList(variations);

    [UserMapping(Default = true)]
    private static ICollection<string> CopyTags(string[] tags) => MapperConventions.CopyList(tags);
}
