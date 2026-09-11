#nullable enable

using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Domain.Observability;

/// <summary>
/// Identifier for one logical flag or segment change, used to stitch together the stages that handle
/// it. Emitted on logs and spans under <see cref="CorrelationFields.ChangeId"/>.
/// </summary>
/// <remarks>
/// <para>
/// <b>Derived, not generated.</b> The identifier is a hash of the change's natural identity —
/// resource type, environment, key, and version — rather than a random value. Every service that
/// receives the change already carries those four fields in the message it consumes, so each can
/// compute the same identifier independently.
/// </para>
/// <para>
/// That is what makes this useful without a wire-format change: attaching a generated identifier to
/// the message payload would require a new envelope, which producers and consumers would have to be
/// upgraded for in lockstep. A derived identifier needs no such coordination.
/// </para>
/// <para>
/// <b>Its remaining job is to identify a change, not to join services.</b> Trace context is now
/// carried on the wire by every transport, so spans from the producing and consuming services are
/// genuinely parented and share a <c>trace_id</c> — that is what joins them. What a
/// <c>trace_id</c> cannot answer is <i>which</i> logical change a span belongs to when one trace
/// carries several: a bulk flag update, or a shared segment that fans out to one message per
/// environment. That is this identifier's purpose.
/// </para>
/// <para>
/// It is not a broader-coverage fallback, and should not be described as one.
/// <see cref="ActivityCorrelation.SetChangeId"/> is a no-op when <c>Activity.Current</c> is null,
/// and <see cref="ActivityCorrelation.CurrentChangeId"/> reads it back off that same ambient
/// activity — so it has exactly the same availability constraint as trace propagation, not a wider
/// one.
/// </para>
/// <para>
/// The hash is unkeyed by design, since a shared secret would defeat independent derivation. It
/// carries no confidential input: a flag key is not a secret, and the environment identifier is
/// already present in the message.
/// </para>
/// </remarks>
public static class ChangeId
{
    /// <summary>Resource type for a feature-flag change.</summary>
    public const string FlagResource = "flag";

    /// <summary>Resource type for a segment change.</summary>
    public const string SegmentResource = "segment";

    /// <summary>Number of hexadecimal characters in a derived identifier.</summary>
    public const int Length = 16;

    /// <summary>
    /// Derives the identifier for a change.
    /// </summary>
    /// <param name="resourceType">
    /// <see cref="FlagResource"/> or <see cref="SegmentResource"/>.
    /// </param>
    /// <param name="envId">Environment the change belongs to.</param>
    /// <param name="key">Flag or segment key.</param>
    /// <param name="version">
    /// Version of the change, normally the Unix-milliseconds form of the resource's
    /// <c>UpdatedAt</c>. Including it means two edits to the same flag produce different identifiers.
    /// </param>
    public static string For(string resourceType, Guid envId, string? key, long version)
    {
        // Unit separator between fields: it cannot occur in a key, so distinct inputs cannot be
        // concatenated into an identical string (e.g. key "a|b" vs. two fields "a" and "b").
        var material = string.Create(
            CultureInfo.InvariantCulture,
            $"{resourceType}\u001f{envId:N}\u001f{key}\u001f{version}");

        return Hash(material);
    }

    /// <summary>
    /// Derives the identifier for a change whose version is a timestamp.
    /// </summary>
    /// <remarks>
    /// The timestamp is normalized to UTC first. A producer holding <see cref="DateTimeKind.Utc"/>
    /// or <see cref="DateTimeKind.Unspecified"/> and a consumer that parsed the same instant back
    /// out of JSON as <see cref="DateTimeKind.Local"/> must yield the same identifier, or the two
    /// services would compute different values for one change and correlation would silently fail.
    /// </remarks>
    public static string For(string resourceType, Guid envId, string? key, DateTime updatedAt)
    {
        var utc = updatedAt.Kind switch
        {
            DateTimeKind.Local => updatedAt.ToUniversalTime(),
            _ => DateTime.SpecifyKind(updatedAt, DateTimeKind.Utc)
        };

        return For(resourceType, envId, key, new DateTimeOffset(utc).ToUnixTimeMilliseconds());
    }

    /// <summary>
    /// Derives the identifier from the serialized form of a flag or segment, as received from the
    /// message queue.
    /// </summary>
    /// <param name="element">
    /// The resource object, expected to carry <c>envId</c>, <c>key</c>, and <c>updatedAt</c>.
    /// </param>
    /// <param name="resourceType">
    /// <see cref="FlagResource"/> or <see cref="SegmentResource"/>.
    /// </param>
    /// <returns>
    /// The identifier, or <c>null</c> when the payload lacks the fields needed to derive one.
    /// Correlation is best-effort: a message that cannot be identified is still handled normally.
    /// </returns>
    /// <remarks>
    /// This lives beside the value-typed overloads on purpose. The producing and consuming services
    /// must derive identically or the identifier correlates nothing, so both sides call the same
    /// code rather than re-implementing the field order and formatting.
    /// </remarks>
    public static string? FromJson(JsonElement element, string resourceType)
    {
        if (element.ValueKind != JsonValueKind.Object)
        {
            return null;
        }

        if (!element.TryGetProperty("envId", out var envIdElement) ||
            !envIdElement.TryGetGuid(out var envId))
        {
            return null;
        }

        if (!element.TryGetProperty("updatedAt", out var updatedAtElement) ||
            !updatedAtElement.TryGetDateTime(out var updatedAt))
        {
            return null;
        }

        var key = element.TryGetProperty("key", out var keyElement)
            ? keyElement.GetString()
            : null;

        return For(resourceType, envId, key, updatedAt);
    }

    /// <summary>
    /// A random identifier, for a change with no stable natural identity. Prefer
    /// <see cref="For(string,Guid,string,long)"/>: a random value cannot be re-derived by another
    /// service, so it correlates within one service only.
    /// </summary>
    public static string New() => Guid.NewGuid().ToString("N")[..Length];

    private static string Hash(string material)
    {
        Span<byte> digest = stackalloc byte[32];
        SHA256.HashData(Encoding.UTF8.GetBytes(material), digest);
        return Convert.ToHexString(digest[..(Length / 2)]).ToLowerInvariant();
    }
}
