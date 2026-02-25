using System.Text.Json;

namespace Api.Services;

public static class TagFilterMode
{
    public const string And = "and";
    public const string Or = "or";
}

public class FeatureFlagFilter
{
    public string? TagFilterMode { get; set; } = "and";

    public string[]? Tags { get; set; } = [];

    public string[]? Keys { get; set; } = [];

    public long? Timestamp { get; set; }
}

public interface IFeatureFlagService
{
    Task<ICollection<JsonElement>> GetListAsync(Guid envId, FeatureFlagFilter userFilter);
}