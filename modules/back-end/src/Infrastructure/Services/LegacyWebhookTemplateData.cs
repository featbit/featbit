using System.Text.Json;
using System.Text.RegularExpressions;
using Domain.Utils;
using HandlebarsDotNet;
using HandlebarsDotNet.IO;

namespace Infrastructure.Services;

internal static class LegacyWebhookTemplateData
{
    public static string Render(string template, Dictionary<string, object> source)
    {
        var data = ForRendering(template, source);
        if (ReferenceEquals(data, source)) return Handlebars.Compile(template)(source);

        // Keep booleans false for conditionals, but emit JSON-compatible lowercase text.
        // Do not change the global Handlebars environment used by other templates.
        var handlebars = Handlebars.Create();
        HandlebarsHelpers.RegisterHelpers(handlebars);
        handlebars.Configuration.FormatterProviders.Add(new BooleanFormatter());
        return handlebars.Compile(template)(data);
    }

    // Only explicitly referenced legacy properties are supplied, and only in a
    // private rendering copy. New templates and persisted flag data stay unchanged.
    private static Dictionary<string, object> ForRendering(string template, Dictionary<string, object> source)
    {
        var references = Regex.Matches(template, @"\{\{[^{}]*\}\}")
            .Select(match => match.Value).ToArray();
        bool References(string name) => references.Any(expression =>
            Regex.IsMatch(expression, $@"\b{name}\b"));

        var allTargets = References("exptIncludeAllTargets");
        var included = References("includedInExpt");
        var rollout = References("exptRollout");
        if ((!allTargets && !included && !rollout) ||
            !source.TryGetValue("data", out var value) ||
            value is not Dictionary<string, object> data ||
            !data.TryGetValue("kind", out var kind) || !Equals(kind, "feature flag"))
        {
            return source;
        }

        var flag = (Dictionary<string, object>)Copy(
            JsonSerializer.SerializeToElement(data["object"], ReusableJsonSerializerOptions.Web));
        if (allTargets) flag.TryAdd("exptIncludeAllTargets", false);
        if (flag.TryGetValue("rules", out var rules) && rules is object[] ruleArray)
        {
            foreach (var rule in ruleArray.OfType<Dictionary<string, object>>()) AddRuleDefaults(rule);
        }
        if (flag.TryGetValue("fallthrough", out var fallthrough) &&
            fallthrough is Dictionary<string, object> defaultRule) AddRuleDefaults(defaultRule);

        return new Dictionary<string, object>(source)
        {
            ["data"] = new Dictionary<string, object>(data) { ["object"] = flag }
        };

        void AddRuleDefaults(Dictionary<string, object> rule)
        {
            if (included) rule.TryAdd("includedInExpt", false);
            if (rollout && rule.TryGetValue("variations", out var variations) && variations is object[] array)
            {
                foreach (var variation in array.OfType<Dictionary<string, object>>())
                    variation.TryAdd("exptRollout", 0);
            }
        }
    }

    private static object Copy(JsonElement value) => value.ValueKind switch
    {
        JsonValueKind.Object => value.EnumerateObject().ToDictionary(x => x.Name, x => Copy(x.Value)),
        JsonValueKind.Array => value.EnumerateArray().Select(Copy).ToArray(),
        JsonValueKind.String => value.GetString()!,
        JsonValueKind.True => true,
        JsonValueKind.False => false,
        JsonValueKind.Number => value.Clone(),
        _ => null!
    };

    private sealed class BooleanFormatter : IFormatter, IFormatterProvider
    {
        public bool TryCreateFormatter(Type type, out IFormatter formatter)
        {
            formatter = this;
            return type == typeof(bool);
        }

        public void Format<T>(T value, in EncodedTextWriter writer) =>
            writer.Write(value is true ? "true" : "false");
    }
}
