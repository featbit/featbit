using System.Text.RegularExpressions;

namespace FeatBit.Observability.TestKit;

public sealed record LoggerMessageToStringAllowance(
    string RelativePath,
    string MethodName,
    string Expression,
    string Reason);

public sealed record LoggerMessageToStringOccurrence(
    string RelativePath,
    int LineNumber,
    string MethodName,
    string Expression,
    string Invocation);

public sealed record LoggerMessagePayloadGuardResult(
    IReadOnlyList<LoggerMessageToStringOccurrence> Allowed,
    IReadOnlyList<LoggerMessageToStringOccurrence> Disallowed);

public static partial class LoggerMessagePayloadGuard
{
    private static readonly Regex ToStringCallRegex = ToStringCall();

    public static string LocateRepositoryRoot(Type anchorType)
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);

        while (directory is not null)
        {
            if (Directory.Exists(Path.Combine(directory.FullName, "modules")) &&
                File.Exists(Path.Combine(directory.FullName, "CONTRIBUTING-tests.md")))
            {
                return directory.FullName;
            }

            directory = directory.Parent;
        }

        throw new InvalidOperationException(
            $"Could not locate the repository root from test assembly '{anchorType.Assembly.Location}'. " +
            "The LoggerMessage payload guard must fail rather than silently pass when source files " +
            "cannot be found.");
    }

    public static LoggerMessagePayloadGuardResult ScanModule(
        string repositoryRoot,
        string modulePath,
        IEnumerable<LoggerMessageToStringAllowance> allowances)
    {
        var srcRoot = Path.GetFullPath(Path.Combine(repositoryRoot, modulePath, "src"));
        if (!Directory.Exists(srcRoot))
        {
            throw new DirectoryNotFoundException(
                $"Could not find source tree '{srcRoot}' for the LoggerMessage payload guard.");
        }

        var allowanceLookup = allowances
            .GroupBy(Normalize)
            .ToDictionary(group => group.Key, group => group.ToArray(), StringComparer.Ordinal);

        var allowed = new List<LoggerMessageToStringOccurrence>();
        var disallowed = new List<LoggerMessageToStringOccurrence>();

        foreach (var file in Directory.EnumerateFiles(srcRoot, "*.cs", SearchOption.AllDirectories)
                     .OrderBy(path => path, StringComparer.OrdinalIgnoreCase))
        {
            var source = File.ReadAllText(file);
            var relativePath = NormalizePath(Path.GetRelativePath(repositoryRoot, file));

            foreach (var occurrence in FindOccurrences(source, relativePath))
            {
                if (allowanceLookup.TryGetValue(Normalize(occurrence), out _))
                {
                    allowed.Add(occurrence);
                }
                else
                {
                    disallowed.Add(occurrence);
                }
            }
        }

        return new LoggerMessagePayloadGuardResult(allowed, disallowed);
    }

    public static string FormatFailures(IReadOnlyList<LoggerMessageToStringOccurrence> occurrences)
    {
        if (occurrences.Count == 0)
        {
            return "No LoggerMessage .ToString() argument coercions found.";
        }

        var lines = new List<string>
        {
            "Disallowed LoggerMessage .ToString() argument coercions found.",
            "Do not call .ToString() to satisfy a generated logging method parameter; widen the",
            "LoggerMessage parameter to the argument's real CLR type instead. If the value is",
            "intentionally formatted text, add a narrow allowance with a reason.",
            string.Empty
        };

        lines.AddRange(occurrences.Select(occurrence =>
            $"{occurrence.RelativePath}:{occurrence.LineNumber} " +
            $"Log.{occurrence.MethodName}(...) argument '{occurrence.Expression}'"));

        return string.Join(Environment.NewLine, lines);
    }

    public static string FormatUnusedAllowances(
        IReadOnlyList<LoggerMessageToStringAllowance> allowances,
        IReadOnlyList<LoggerMessageToStringOccurrence> allowedOccurrences)
    {
        var matched = allowedOccurrences.Select(Normalize).ToHashSet(StringComparer.Ordinal);
        var unused = allowances.Where(allowance => !matched.Contains(Normalize(allowance))).ToArray();

        if (unused.Length == 0)
        {
            return "All LoggerMessage .ToString() allowances matched source occurrences.";
        }

        return "LoggerMessage .ToString() allowances did not match source occurrences:" +
               Environment.NewLine +
               string.Join(Environment.NewLine, unused.Select(allowance =>
                   $"{NormalizePath(allowance.RelativePath)} Log.{allowance.MethodName}(...) " +
                   $"argument '{allowance.Expression}': {allowance.Reason}"));
    }

    private static IEnumerable<LoggerMessageToStringOccurrence> FindOccurrences(string source, string relativePath)
    {
        var index = 0;
        while (index < source.Length)
        {
            index = SkipTriviaOrLiteral(source, index);
            if (index >= source.Length)
            {
                yield break;
            }

            if (TryReadLogInvocation(source, index, out var invocation))
            {
                var argumentText = source[(invocation.OpenParenIndex + 1)..invocation.CloseParenIndex];
                foreach (Match match in ToStringCallRegex.Matches(argumentText))
                {
                    var expression = Regex.Replace(match.Value, @"\s+", string.Empty);
                    var absoluteIndex = invocation.OpenParenIndex + 1 + match.Index;

                    yield return new LoggerMessageToStringOccurrence(
                        relativePath,
                        LineNumber(source, absoluteIndex),
                        invocation.MethodName,
                        expression,
                        source[invocation.StartIndex..(invocation.CloseParenIndex + 1)]);
                }

                index = invocation.CloseParenIndex + 1;
                continue;
            }

            index++;
        }
    }

    private static int SkipTriviaOrLiteral(string source, int index)
    {
        if (index + 1 < source.Length && source[index] == '/' && source[index + 1] == '/')
        {
            var newline = source.IndexOf('\n', index + 2);
            return newline < 0 ? source.Length : newline + 1;
        }

        if (index + 1 < source.Length && source[index] == '/' && source[index + 1] == '*')
        {
            var end = source.IndexOf("*/", index + 2, StringComparison.Ordinal);
            return end < 0 ? source.Length : end + 2;
        }

        if (source[index] == '"' || source[index] == '\'')
        {
            return SkipLiteral(source, index);
        }

        return index;
    }

    private static int SkipLiteral(string source, int index)
    {
        if (source[index] == '"')
        {
            if (index + 2 < source.Length && source[index + 1] == '"' && source[index + 2] == '"')
            {
                var end = source.IndexOf("\"\"\"", index + 3, StringComparison.Ordinal);
                return end < 0 ? source.Length : end + 3;
            }

            var verbatim = index > 0 && source[index - 1] == '@';
            for (var current = index + 1; current < source.Length; current++)
            {
                if (source[current] != '"')
                {
                    if (!verbatim && source[current] == '\\')
                    {
                        current++;
                    }

                    continue;
                }

                if (verbatim && current + 1 < source.Length && source[current + 1] == '"')
                {
                    current++;
                    continue;
                }

                return current + 1;
            }

            return source.Length;
        }

        for (var current = index + 1; current < source.Length; current++)
        {
            if (source[current] == '\\')
            {
                current++;
                continue;
            }

            if (source[current] == '\'')
            {
                return current + 1;
            }
        }

        return source.Length;
    }

    private static bool TryReadLogInvocation(string source, int index, out LogInvocation invocation)
    {
        invocation = default;

        if (!source.AsSpan(index).StartsWith("Log.", StringComparison.Ordinal))
        {
            return false;
        }

        if (index > 0 && (IsIdentifierPart(source[index - 1]) || source[index - 1] == '.'))
        {
            return false;
        }

        var methodStart = index + 4;
        if (methodStart >= source.Length || !IsIdentifierStart(source[methodStart]))
        {
            return false;
        }

        var methodEnd = methodStart + 1;
        while (methodEnd < source.Length && IsIdentifierPart(source[methodEnd]))
        {
            methodEnd++;
        }

        var openParen = methodEnd;
        while (openParen < source.Length && char.IsWhiteSpace(source[openParen]))
        {
            openParen++;
        }

        if (openParen >= source.Length || source[openParen] != '(')
        {
            return false;
        }

        var closeParen = FindCloseParen(source, openParen);
        if (closeParen < 0)
        {
            return false;
        }

        invocation = new LogInvocation(
            index,
            source[methodStart..methodEnd],
            openParen,
            closeParen);

        return true;
    }

    private static int FindCloseParen(string source, int openParen)
    {
        var depth = 0;
        for (var index = openParen; index < source.Length; index++)
        {
            var next = SkipTriviaOrLiteral(source, index);
            if (next != index)
            {
                index = next - 1;
                continue;
            }

            if (source[index] == '(')
            {
                depth++;
            }
            else if (source[index] == ')')
            {
                depth--;
                if (depth == 0)
                {
                    return index;
                }
            }
        }

        return -1;
    }

    private static int LineNumber(string source, int index)
    {
        var line = 1;
        for (var current = 0; current < index && current < source.Length; current++)
        {
            if (source[current] == '\n')
            {
                line++;
            }
        }

        return line;
    }

    private static string Normalize(LoggerMessageToStringAllowance allowance)
        => $"{NormalizePath(allowance.RelativePath)}|{allowance.MethodName}|{NormalizeExpression(allowance.Expression)}";

    private static string Normalize(LoggerMessageToStringOccurrence occurrence)
        => $"{NormalizePath(occurrence.RelativePath)}|{occurrence.MethodName}|{NormalizeExpression(occurrence.Expression)}";

    private static string NormalizePath(string path) => path.Replace('/', '\\');

    private static string NormalizeExpression(string expression)
        => Regex.Replace(expression, @"\s+", string.Empty);

    private static bool IsIdentifierStart(char value) => value == '_' || char.IsLetter(value);

    private static bool IsIdentifierPart(char value) => value == '_' || char.IsLetterOrDigit(value);

    [GeneratedRegex(@"(?<![\w])(?:[A-Za-z_][A-Za-z0-9_]*\.)*[A-Za-z_][A-Za-z0-9_]*\s*\.\s*ToString\s*\(\s*\)")]
    private static partial Regex ToStringCall();

    private readonly record struct LogInvocation(
        int StartIndex,
        string MethodName,
        int OpenParenIndex,
        int CloseParenIndex);
}
