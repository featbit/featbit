using Domain.Environments;
using Domain.FeatureFlags;
using Domain.Segments;

namespace Domain.Webhooks;

public static class DataObjectBuilder
{
    public static Dictionary<string, object> New(string[] events, string @operator, DateTime happenedAt)
    {
        var dataObject = new Dictionary<string, object>
        {
            ["events"] = string.Join(',', events),
            ["operator"] = @operator,
            ["happenedAt"] = happenedAt
        };

        return dataObject;
    }

    public static Dictionary<string, object> AddResourceDescriptor(
        this Dictionary<string, object> dataObject,
        ResourceDescriptor descriptor)
    {
        dataObject["organization"] = new Dictionary<string, object>
        {
            ["id"] = descriptor.Organization.Id,
            ["name"] = descriptor.Organization.Name
        };

        dataObject["project"] = new Dictionary<string, object>
        {
            ["id"] = descriptor.Project.Id,
            ["name"] = descriptor.Project.Name
        };

        dataObject["environment"] = new Dictionary<string, object>
        {
            ["id"] = descriptor.Environment.Id,
            ["name"] = descriptor.Environment.Name
        };

        return dataObject;
    }

    public static Dictionary<string, object> AddFeatureFlag(
        this Dictionary<string, object> dataObject,
        FeatureFlag flag)
    {
        dataObject["data"] = new Dictionary<string, object>
        {
            ["kind"] = "feature flag",
            ["object"] = new Dictionary<string, object>
            {
                ["id"] = flag.Id.ToString("D"),
                ["name"] = flag.Name,
                ["description"] = flag.Description,
                ["key"] = flag.Key,
                ["variationType"] = flag.VariationType,
                ["variations"] = flag.Variations,
                ["targetUsers"] = flag.TargetUsers,
                ["rules"] = flag.Rules,
                ["isEnabled"] = BooleanToString(flag.IsEnabled),
                ["disabledVariationId"] = flag.DisabledVariationId,
                ["fallthrough"] = flag.Fallthrough,
                ["exptIncludeAllTargets"] = BooleanToString(flag.ExptIncludeAllTargets),
                ["tags"] = flag.Tags,
                ["isArchived"] = BooleanToString(flag.IsArchived)
            }
        };

        return dataObject;
    }

    public static Dictionary<string, object> AddSegment(
        this Dictionary<string, object> dataObject,
        Segment segment,
        IEnumerable<FlagReference> flagReferences)
    {
        dataObject["data"] = new Dictionary<string, object>
        {
            ["kind"] = "segment",
            ["object"] = new Dictionary<string, object>
            {
                ["id"] = segment.Id.ToString("D"),
                ["name"] = segment.Name,
                ["description"] = segment.Description,
                ["included"] = segment.Included,
                ["excluded"] = segment.Excluded,
                ["rules"] = segment.Rules,
                ["isArchived"] = BooleanToString(segment.IsArchived),
                ["flagReferences"] = flagReferences
            }
        };

        return dataObject;
    }

    public static Dictionary<string, object> AddChanges(this Dictionary<string, object> dataObject, string[] changes)
    {
        dataObject["changes"] = changes;

        return dataObject;
    }

    private static string BooleanToString(this bool value) => value ? "true" : "false";
}