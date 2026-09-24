using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;
using Application.ReleaseHealth;
using HandlebarsDotNet;

namespace Infrastructure.ReleaseHealth;

// Configuration validation only. This renderer never opens a network connection.
internal static class MonitorWebhookTemplate
{
    private static readonly Regex Expressions = new(@"\{\{\{(?<expression>.*?)\}\}\}|\{\{(?<expression>.*?)\}\}", RegexOptions.Singleline, TimeSpan.FromSeconds(1));

    public static void Validate(string template)
    {
        if (string.IsNullOrWhiteSpace(template) || template.Length > 32768) throw Schema.Invalid("invalid_webhook_template");
        try
        {
            var engine = Handlebars.Create(new HandlebarsConfiguration { ThrowOnUnresolvedBindingExpression = true });
            var values = new Dictionary<string, object?>();
            var prefix = $"__rh_{Guid.NewGuid():N}_";
            var separator = $"{prefix}separator__";
            engine.RegisterHelper("rhValue", (writer, _, arguments) =>
            {
                if (arguments.Length != 1) throw new InvalidOperationException();
                var token = $"{prefix}{values.Count}__";
                values[token] = arguments[0];
                writer.WriteSafeString(token);
            });
            engine.RegisterHelper("json", (writer, _, arguments) => writer.WriteSafeString(JsonSerializer.Serialize(arguments[0])));
            engine.RegisterHelper("eq", (context, arguments) => arguments.Length == 2 && Equals(arguments[0], arguments[1]));
            var rewritten = Expressions.Replace(template, match =>
            {
                var expression = match.Groups["expression"].Value.Trim();
                if (expression.Length == 0) throw new InvalidOperationException();
                if (expression[0] is '#' or '/' or '!' or '^' || expression == "else" || expression.StartsWith("else ") || expression.StartsWith("json ")) return match.Value + separator;
                if (expression.StartsWith('>') || expression.StartsWith('&') || expression.Contains("rhValue")) throw new InvalidOperationException();
                // Separate the Handlebars closing delimiter from an adjacent JSON '}'.
                return "{{rhValue " + (expression.Contains(' ') ? $"({expression})" : expression) + "}}" + separator;
            });
            var render = engine.Compile(rewritten);
            foreach (var sample in Samples())
            {
                values.Clear();
                var output = Resolve(render(sample).Replace(separator, ""), prefix, values);
                using var parsed = JsonDocument.Parse(output);
                if (parsed.RootElement.ValueKind != JsonValueKind.Object) throw new InvalidOperationException();
            }
        }
        catch (Exception exception) when (exception is not OperationCanceledException)
        {
            // Do not disclose template contents or credentials in validation errors.
            throw Schema.Invalid("invalid_webhook_template");
        }
    }

    private static string Resolve(string rendered, string prefix, Dictionary<string, object?> values)
    {
        StringBuilder result = new();
        var quoted = false;
        var escaped = false;
        for (var i = 0; i < rendered.Length;)
        {
            if (rendered.AsSpan(i).StartsWith(prefix))
            {
                var end = rendered.IndexOf("__", i + prefix.Length, StringComparison.Ordinal);
                if (end >= 0 && values.TryGetValue(rendered[i..(end + 2)], out var value))
                {
                    if (escaped) throw new InvalidOperationException();
                    var json = JsonSerializer.Serialize(value);
                    result.Append(quoted ? JsonSerializer.Serialize(value is null ? "" : value is string text ? text : json)[1..^1] : json);
                    i = end + 2;
                    continue;
                }
            }
            var character = rendered[i++];
            result.Append(character);
            if (escaped) escaped = false;
            else if (quoted && character == '\\') escaped = true;
            else if (character == '"') quoted = !quoted;
        }
        return result.ToString();
    }

    private static Dictionary<string, object?> Object(params (string Key, object? Value)[] properties) => properties.ToDictionary(x => x.Key, x => x.Value);

    private static IEnumerable<Dictionary<string, object?>> Samples()
    {
        var profiles = new[] { ("gauge", "count"), ("gauge", "percent"), ("gauge", "ratio"), ("gauge", "duration"),
            ("gauge", "data"), ("count", "count"), ("ratio", "percent"), ("ratio", "ratio"), ("rate", "rate") };
        foreach (var (measurement, unit) in profiles)
        foreach (var numerator in unit == "rate" ? new[] { "requests", "operations", "events", "items", "bytes", "errors" } : new[] { "" })
        foreach (var period in unit == "rate" ? new[] { "second", "minute", "hour" } : new[] { "" })
        foreach (var severity in new[] { "warning", "critical" })
        foreach (var recovered in new[] { false, true })
        {
            var type = recovered ? "alert.recovered" : "alert.triggered";
            var timestamp = "2026-09-17T02:10:00Z";
            yield return Object(
                ("event", Object(("id", "sample-event"), ("type", type), ("happenedAt", timestamp))),
                ("organization", Object(("id", "sample-org"), ("name", "Example organization"))),
                ("project", Object(("id", "sample-project"), ("key", "storefront"), ("name", "Storefront"))),
                ("environment", Object(("id", "sample-env"), ("key", "production"), ("name", "Production"))),
                ("flag", Object(("id", "sample-flag"), ("key", "new-checkout"), ("name", "New \"checkout\"\\draft"))),
                ("metric", Object(("id", "sample-metric"), ("key", "checkout"), ("name", "Checkout"), ("version", 1), ("versionId", "sample-version"),
                    ("resultSemantics", "The provider-computed value in this observation window."), ("unit", unit), ("fractionDigits", 2),
                    ("resultContract", Object(("schemaVersion", 1), ("resultKind", "numeric_time_series"), ("cardinality", "single"), ("measurementKind", measurement),
                        ("unit", Object(("kind", unit), ("scale", unit == "percent" ? "zero_to_one_hundred" : unit == "ratio" ? "zero_to_one" : null),
                            ("base", unit == "duration" ? "millisecond" : unit == "data" ? "byte" : null), ("numerator", unit == "rate" ? numerator : null), ("per", unit == "rate" ? period : null))),
                        ("constraints", Object(("minimum", unit is "ratio" or "percent" || measurement == "count" ? 0 : null),
                            ("maximum", unit == "percent" ? 100 : unit == "ratio" ? 1 : null), ("allowNaN", false), ("allowInfinity", false))))))),
                ("binding", Object(("id", "sample-binding"))),
                ("rule", Object(("id", "sample-rule"), ("name", "Example rule"), ("revision", 1), ("severity", severity))),
                ("condition", Object(("operator", ">"), ("threshold", 0.5), ("lookbackMinutes", 5), ("reducer", "average"),
                    ("sustainMinutes", 5), ("recoveryMinutes", 5), ("evaluationIntervalMinutes", 1), ("warmupMinutes", 0), ("dataDelayMinutes", 0))),
                ("evaluation", Object(("windowStart", timestamp), ("windowEnd", timestamp), ("value", recovered ? 0.2 : 0.8),
                    ("dataStatus", "ready"), ("checkedAt", timestamp), ("healthStatus", recovered ? "healthy" : severity))),
                ("alert", Object(("id", "sample-alert"), ("triggeredAt", timestamp), ("recoveredAt", recovered ? timestamp : null))),
                ("evidence", Object(("url", "https://example.com/evidence/sample"), ("sourceBindingRevision", 1))));
        }
    }
}


