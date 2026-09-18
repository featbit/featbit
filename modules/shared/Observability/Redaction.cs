#nullable enable

using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;

namespace Domain.Observability;

/// <summary>
/// Keeps credentials out of logs, metrics, and traces while leaving everything else legible.
/// </summary>
/// <remarks>
/// <para>
/// <b>Scope: credentials only.</b> This deliberately protects a narrow surface — SDK secrets,
/// streaming tokens, and relay-proxy tokens. Message payloads, query strings, client IP addresses,
/// and webhook URLs are logged <i>raw</i>, because that content is what actually makes an incident
/// diagnosable and the signals carrying it are operator-facing.
/// </para>
/// <para>
/// <b>Hash, do not drop.</b> A raw credential in a log is usable by anyone who can read the log —
/// FeatBit's SDK credentials authenticate a client and grant read access to flag configuration.
/// A stable hash still answers "was this the same caller?", "is one token failing repeatedly?",
/// and "is this the same token we saw on the other pod?", which is the whole diagnostic value.
/// </para>
/// <para>
/// Hashing is HMAC-SHA256 keyed by a per-deployment salt, truncated to 16 hexadecimal characters.
/// The salt matters: a plain digest of a credential is reversible by anyone who can enumerate
/// candidate values, so an unkeyed hash would not actually protect it.
/// </para>
/// <para>
/// Set <c>FEATBIT_REDACTION_SALT</c> — or <c>Observability:RedactionSalt</c> in configuration — to a
/// strong random value, identical across all pods of a deployment, to correlate a caller across
/// instances and restarts. If it is unset a random salt is generated per process, which still
/// redacts correctly but confines correlation to that one process's lifetime.
/// </para>
/// </remarks>
public static partial class Redaction
{
    /// <summary>Environment variable holding the deployment-wide HMAC salt.</summary>
    public const string SaltVariable = "FEATBIT_REDACTION_SALT";

    /// <summary>Placeholder for a null or empty input.</summary>
    public const string None = "(none)";

    private const int HashHexLength = 16;

    private static readonly Lock SaltLock = new();
    private static byte[]? _salt;

    /// <summary>
    /// The active HMAC key, materialized on first use from <see cref="SaltVariable"/> or a random
    /// value.
    /// </summary>
    /// <remarks>
    /// Resolved lazily rather than in a field initializer. A <c>static readonly</c> initializer runs
    /// at type load, which can happen before the composition root executes — so
    /// <see cref="ConfigureSalt"/> would have silently had no effect while appearing to work, and
    /// the deployment would have kept a random per-process salt.
    /// </remarks>
    private static byte[] Salt
    {
        get
        {
            var current = Volatile.Read(ref _salt);
            if (current is not null)
            {
                return current;
            }

            lock (SaltLock)
            {
                return _salt ??= ResolveSalt();
            }
        }
    }

    /// <summary>
    /// Sets the HMAC salt from configuration. Call once from the composition root, before anything
    /// is hashed. A null or blank value leaves the environment-derived salt in place.
    /// </summary>
    /// <exception cref="InvalidOperationException">
    /// Thrown if a <i>different</i> salt has already been used to hash a value. Failing loudly is
    /// deliberate: silently ignoring the call would produce hashes that cannot be correlated across
    /// pods, and nothing in the output would reveal that the configured salt was never applied.
    /// </exception>
    public static void ConfigureSalt(string? salt)
    {
        if (string.IsNullOrWhiteSpace(salt))
        {
            return;
        }

        var bytes = Encoding.UTF8.GetBytes(salt);

        lock (SaltLock)
        {
            if (_salt is not null && !_salt.AsSpan().SequenceEqual(bytes))
            {
                throw new InvalidOperationException(
                    $"The redaction salt was already in use before {nameof(ConfigureSalt)} was called, " +
                    "so the configured value cannot be applied. Configure it in the composition root " +
                    "before any value is redacted.");
            }

            _salt = bytes;
        }
    }

    /// <summary>
    /// Query-string and JSON field names whose <i>values</i> are credentials.
    /// </summary>
    /// <remarks>
    /// This is a denylist, which normally fails open — a newly added credential parameter leaks
    /// until someone adds it here. That trade-off is accepted deliberately: the alternative
    /// (redacting every value) is what this class used to do, and it was rejected because it
    /// destroyed the diagnostic value of query strings and message payloads. The names below are
    /// substring-matched, so <c>clientToken</c> and <c>access_token</c> are both covered by
    /// <c>token</c>.
    /// </remarks>
    private static readonly string[] CredentialNames = ["token", "secret", "authorization", "apikey", "api_key"];

    /// <summary>
    /// Matches a JSON property whose name contains a credential word, capturing its string value.
    /// </summary>
    [GeneratedRegex(
        "\"(?<key>[A-Za-z0-9_]*(?:token|secret|authorization|apikey|api_key)[A-Za-z0-9_]*)\"\\s*:\\s*\"(?<value>(?:[^\"\\\\]|\\\\.)*)\"",
        RegexOptions.IgnoreCase | RegexOptions.CultureInvariant)]
    private static partial Regex CredentialPropertyRegex();

    /// <summary>
    /// Keyed, truncated hash of <paramref name="value"/>, prefixed so the field's kind stays legible
    /// in a log line.
    /// </summary>
    public static string Hash(string? value, string prefix)
    {
        if (string.IsNullOrEmpty(value))
        {
            return None;
        }

        using var hmac = new HMACSHA256(Salt);
        var digest = hmac.ComputeHash(Encoding.UTF8.GetBytes(value));
        return string.Concat(prefix, Convert.ToHexString(digest).AsSpan(0, HashHexLength).ToString().ToLowerInvariant());
    }

    /// <summary>
    /// Redacts an SDK secret, streaming token, relay-proxy token, API key, or JWT. Never log the
    /// raw value.
    /// </summary>
    public static string Token(string? token) => Hash(token, "tok_");

    /// <summary>
    /// Returns <paramref name="queryString"/> with keys and ordinary values intact, hashing only the
    /// values of credential-bearing parameters.
    /// </summary>
    /// <remarks>
    /// The evaluation server's streaming token travels in the query string as <c>?token=…</c>, which
    /// is why the raw query string must not be logged even though every other parameter is safe.
    /// This is also why <c>IncludeQueryInRequestPath</c> stays <c>false</c> in the Serilog request
    /// logging of all three services: the query is re-attached through here instead.
    /// </remarks>
    public static string QueryString(string? queryString)
    {
        if (string.IsNullOrEmpty(queryString))
        {
            return None;
        }

        var query = queryString.StartsWith('?') ? queryString[1..] : queryString;
        if (query.Length == 0)
        {
            return None;
        }

        var builder = new StringBuilder(query.Length);
        builder.Append('?');

        var first = true;
        foreach (var pair in query.Split('&', StringSplitOptions.RemoveEmptyEntries))
        {
            if (!first)
            {
                builder.Append('&');
            }

            first = false;

            var separator = pair.IndexOf('=');
            if (separator < 0)
            {
                builder.Append(pair);
                continue;
            }

            var key = pair.AsSpan(0, separator);
            builder.Append(key).Append('=');

            if (IsCredentialName(key))
            {
                builder.Append(Token(pair[(separator + 1)..]));
            }
            else
            {
                builder.Append(pair.AsSpan(separator + 1));
            }
        }

        return builder.ToString();
    }

    /// <summary>
    /// Returns a message payload as-is except for embedded credential values, which are hashed.
    /// </summary>
    /// <remarks>
    /// <para>
    /// Message payloads carry flag rules, segment definitions, and end-user attributes — the content
    /// you actually need to diagnose a malformed or unexpected message — so they are logged in full.
    /// The one exception is <c>ConnectionMessage</c>, which carries the client's SDK secret in a
    /// <c>secret</c> property; without this, unredacting payloads would leak through that back door
    /// every credential the rest of this class protects.
    /// </para>
    /// <para>
    /// The common case (a payload with no credential field) costs one ordinal substring scan and
    /// returns the original string with no allocation.
    /// </para>
    /// </remarks>
    public static string HideCredentials(string? payload)
    {
        if (string.IsNullOrEmpty(payload))
        {
            return None;
        }

        if (!ContainsCredentialName(payload))
        {
            return payload;
        }

        return CredentialPropertyRegex().Replace(
            payload,
            match => string.Concat(
                "\"", match.Groups["key"].Value, "\":\"", Token(match.Groups["value"].Value), "\""));
    }

    private static bool ContainsCredentialName(string value)
    {
        foreach (var name in CredentialNames)
        {
            if (value.Contains(name, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static bool IsCredentialName(ReadOnlySpan<char> key)
    {
        foreach (var name in CredentialNames)
        {
            if (key.Contains(name, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
        }

        return false;
    }

    private static byte[] ResolveSalt()
    {
        var configured = Environment.GetEnvironmentVariable(SaltVariable);
        return !string.IsNullOrWhiteSpace(configured)
            ? Encoding.UTF8.GetBytes(configured)
            : RandomNumberGenerator.GetBytes(32);
    }
}
