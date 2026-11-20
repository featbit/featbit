using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text.Encodings.Web;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.Json.Serialization;
using System.Text.RegularExpressions;

namespace TestBase;

/// <summary>
/// Snapshot assertions. The value under test is serialized to JSON and compared with
/// <c>Snapshots/{TestClass}.{TestMethod}[_{suffix}].verified.json</c> in the test project.
/// </summary>
/// <remarks>
/// <para>The JSON is made stable before comparing: object properties are sorted (case-insensitive),
/// <see cref="HttpResponseMessage"/>s are written as status, headers and content (JSON content is
/// parsed), <c>Set-Cookie</c> headers are left out, and strings that are a Guid or a date-time are
/// replaced with <c>Guid_n</c> / <c>DateTime_n</c> / <c>DateTimeOffset_n</c>, numbered in order of
/// first appearance.</para>
/// <para>On a mismatch, or when there is no verified file yet, the result is written to a
/// <c>.received.json</c> file next to it and the assertion fails. If the change is expected, replace
/// the <c>.verified.json</c> file with the <c>.received.json</c> one.</para>
/// </remarks>
public static partial class Snapshot
{
    private static readonly JsonSerializerOptions SerializeOptions = new()
    {
        Converters = { new JsonStringEnumConverter() }
    };

    private static readonly JsonSerializerOptions WriteOptions = new()
    {
        WriteIndented = true,
        NewLine = "\n",
        Encoder = JavaScriptEncoder.UnsafeRelaxedJsonEscaping
    };

    /// <summary>Asserts that <paramref name="value"/> matches the verified snapshot.</summary>
    /// <param name="value">The value under test. Anonymous objects may contain <see cref="HttpResponseMessage"/>s.</param>
    /// <param name="scrub">Applied to every string value before comparing, e.g. to replace a token.</param>
    /// <param name="suffix">Appended to the snapshot name, e.g. a theory parameter (<c>type=full</c>).</param>
    public static async Task Match(
        object? value,
        Func<string, string>? scrub = null,
        string? suffix = null,
        [CallerFilePath] string sourceFile = "",
        [CallerMemberName] string testName = "")
    {
        var node = await ToNodeAsync(value);
        Compare(node, scrub, suffix, sourceFile, testName);
    }

    /// <summary>Asserts that the JSON text <paramref name="json"/> matches the verified snapshot.</summary>
    public static Task MatchJson(
        string json,
        Func<string, string>? scrub = null,
        string? suffix = null,
        [CallerFilePath] string sourceFile = "",
        [CallerMemberName] string testName = "")
    {
        Compare(JsonNode.Parse(json), scrub, suffix, sourceFile, testName);
        return Task.CompletedTask;
    }

    private static void Compare(JsonNode? node, Func<string, string>? scrub, string? suffix, string sourceFile, string testName)
    {
        var actual = Normalize(node, new Scrubber(scrub))?.ToJsonString(WriteOptions) ?? "null";

        var className = Path.GetFileNameWithoutExtension(sourceFile.Replace('\\', '/').Split('/')[^1]);
        var name = suffix is null ? $"{className}.{testName}" : $"{className}.{testName}_{suffix}";
        var directory = Path.Combine(ProjectDirectory(), "Snapshots");
        var verifiedPath = Path.Combine(directory, $"{name}.verified.json");
        var receivedPath = Path.Combine(directory, $"{name}.received.json");

        if (File.Exists(verifiedPath))
        {
            var expected = File.ReadAllText(verifiedPath).Replace("\r\n", "\n").TrimEnd('\n');
            if (expected == actual)
            {
                File.Delete(receivedPath);
                return;
            }

            File.WriteAllText(receivedPath, actual + "\n");
            throw new SnapshotMismatchException(
                $"Snapshot {name} doesn't match.{Environment.NewLine}{FirstDifference(expected, actual)}{Environment.NewLine}" +
                $"Received: {receivedPath}{Environment.NewLine}If the change is expected, replace the .verified.json file with the .received.json one."
            );
        }

        Directory.CreateDirectory(directory);
        File.WriteAllText(receivedPath, actual + "\n");
        throw new SnapshotMismatchException(
            $"Snapshot {name} has no verified file yet.{Environment.NewLine}" +
            $"Review {receivedPath} and rename it to {Path.GetFileName(verifiedPath)}."
        );
    }

    private static async Task<JsonNode?> ToNodeAsync(object? value)
    {
        switch (value)
        {
            case null:
                return null;
            case JsonNode node:
                return node.DeepClone();
            case HttpResponseMessage response:
                return await ResponseAsync(response);
            case string text:
                return JsonValue.Create(text);
            case IEnumerable<KeyValuePair<string, string>> pairs and not IDictionary<string, string>:
            {
                // e.g. Confluent.Kafka configs, which enumerate their settings as key/value pairs
                var obj = new JsonObject();
                foreach (var (key, pairValue) in pairs)
                {
                    obj[key] = pairValue;
                }

                return obj;
            }
        }

        var type = value.GetType();
        if (!IsAnonymous(type))
        {
            return JsonSerializer.SerializeToNode(value, type, SerializeOptions);
        }

        var anonymous = new JsonObject();
        foreach (var property in type.GetProperties())
        {
            anonymous[property.Name] = await ToNodeAsync(property.GetValue(value));
        }

        return anonymous;
    }

    private static async Task<JsonNode> ResponseAsync(HttpResponseMessage response)
    {
        var obj = new JsonObject { ["Status"] = $"{(int)response.StatusCode} {response.ReasonPhrase}" };
        AddHeaders(obj, response.Headers);

        var body = await response.Content.ReadAsStringAsync();
        if (body.Length == 0)
        {
            return obj;
        }

        // Content-Length is only added to the headers once something asks for it.
        _ = response.Content.Headers.ContentLength;

        var isJson = response.Content.Headers.ContentType?.MediaType?.Contains("json", StringComparison.OrdinalIgnoreCase) == true;
        var content = new JsonObject();
        AddHeaders(content, response.Content.Headers);
        content["Value"] = isJson ? JsonNode.Parse(body) : JsonValue.Create(body);
        obj["Content"] = content;

        return obj;
    }

    private static void AddHeaders(JsonObject target, HttpHeaders headers)
    {
        var obj = new JsonObject();
        foreach (var (name, values) in headers)
        {
            // Cookies carry tokens and expiry times that change on every run.
            if (name.Equals("Set-Cookie", StringComparison.OrdinalIgnoreCase))
            {
                continue;
            }

            obj[name] = string.Join(", ", values);
        }

        if (obj.Count > 0)
        {
            target["Headers"] = obj;
        }
    }

    private static JsonNode? Normalize(JsonNode? node, Scrubber scrubber)
    {
        switch (node)
        {
            case JsonObject obj:
            {
                var sorted = new JsonObject();
                foreach (var (key, value) in obj
                             .OrderBy(x => x.Key, StringComparer.OrdinalIgnoreCase)
                             .ThenBy(x => x.Key, StringComparer.Ordinal))
                {
                    sorted[key] = Normalize(value, scrubber);
                }

                return sorted;
            }
            case JsonArray array:
                return new JsonArray(array.Select(x => Normalize(x, scrubber)).ToArray());
            case JsonValue value when value.GetValueKind() == JsonValueKind.String:
                return JsonValue.Create(scrubber.Scrub(value.GetValue<string>()));
            default:
                return node?.DeepClone();
        }
    }

    private static string FirstDifference(string expected, string actual)
    {
        var expectedLines = expected.Split('\n');
        var actualLines = actual.Split('\n');
        for (var i = 0; i < Math.Max(expectedLines.Length, actualLines.Length); i++)
        {
            var e = i < expectedLines.Length ? expectedLines[i] : "<end of file>";
            var a = i < actualLines.Length ? actualLines[i] : "<end of file>";
            if (e != a)
            {
                return $"First difference at line {i + 1}:{Environment.NewLine}  verified: {e.Trim()}{Environment.NewLine}  received: {a.Trim()}";
            }
        }

        return string.Empty;
    }

    // The test project directory: the test assembly runs from {project}/bin/{configuration}/{tfm}.
    private static string ProjectDirectory()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory != null && directory.GetFiles("*.csproj").Length == 0)
        {
            directory = directory.Parent;
        }

        return directory?.FullName ??
               throw new InvalidOperationException($"No test project directory above {AppContext.BaseDirectory}.");
    }

    private static bool IsAnonymous(Type type) =>
        type.IsDefined(typeof(CompilerGeneratedAttribute), false) && type.Name.Contains("AnonymousType");

    private sealed partial class Scrubber(Func<string, string>? custom)
    {
        private readonly Dictionary<string, string> _replacements = new();
        private int _guids;
        private int _dateTimes;
        private int _dateTimeOffsets;

        public string Scrub(string value)
        {
            value = custom?.Invoke(value) ?? value;

            if (_replacements.TryGetValue(value, out var replacement))
            {
                return replacement;
            }

            if (Guid.TryParseExact(value, "D", out _))
            {
                return _replacements[value] = $"Guid_{++_guids}";
            }

            var match = DateTimePattern().Match(value);
            if (match.Success)
            {
                return _replacements[value] = match.Groups["offset"].Success
                    ? $"DateTimeOffset_{++_dateTimeOffsets}"
                    : $"DateTime_{++_dateTimes}";
            }

            return value;
        }

        [GeneratedRegex(@"^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?(?<offset>Z|[+-]\d{2}:\d{2})?$")]
        private static partial Regex DateTimePattern();
    }
}

/// <summary>Thrown when a value doesn't match its verified snapshot.</summary>
public sealed class SnapshotMismatchException(string message) : Exception(message);
