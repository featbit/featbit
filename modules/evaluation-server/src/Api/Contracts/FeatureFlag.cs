using System.Text.Json;
using Api.Services;
using Domain.EndUsers;
using Domain.Evaluation;

namespace Api.Contracts;

public class EvalResultVariation
{
    public string? Id { get; set; }

    public string Type { get; set; }

    public string? Value { get; set; }

    public string MatchReason { get; set; }

    public bool SendToExperiment { get; set; }

    public bool InsightsEnabled { get; set; }

    public EvalResultVariation(string type, UserVariation uv, bool insightsEnabled)
    {
        Id = uv.Variation?.Id;
        Type = type;
        Value = uv.Variation?.Value;
        MatchReason = uv.MatchReason;
        SendToExperiment = uv.SendToExperiment;
        InsightsEnabled = insightsEnabled;
    }
}

public class EvalResult
{
    public string Key { get; set; }

    public EvalResultVariation Variation { get; set; }

    public EvalResult(JsonElement flag, UserVariation uv)
    {
        Key = flag.GetProperty("key").GetString()!;

        var type = flag.GetProperty("variationType").GetString() ?? "string";
        var insightsEnabled =
            EntityJsonReader.TryGetBoolean(flag, "insightsEnabled") ?? true;

        Variation = new EvalResultVariation(type, uv, insightsEnabled);
    }
}

public class EvaluateFlagRequest
{
    public EndUser? User { get; set; }

    public FeatureFlagFilter? Filter { get; set; }

    public bool TryValidate(out string validationError)
    {
        validationError = string.Empty;

        if (User is null || !User.IsValid())
        {
            validationError = "A valid user is required.";
            return false;
        }

        var filterMode = Filter?.TagFilterMode;
        if (!string.IsNullOrWhiteSpace(filterMode))
        {
            var isValidMode = filterMode is TagFilterMode.And or TagFilterMode.Or;
            if (!isValidMode)
            {
                validationError = $"Invalid tag filter mode: {filterMode}. Valid values are 'and' or 'or'.";
                return false;
            }
        }

        return true;
    }
}
