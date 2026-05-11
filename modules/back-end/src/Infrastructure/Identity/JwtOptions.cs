using Microsoft.IdentityModel.Tokens;

namespace Infrastructure.Identity;

/// <summary>
/// Strongly-typed representation of the <c>Jwt</c> configuration section.
/// Supports two signing algorithms:
/// <list type="bullet">
///   <item><description><b>HS256</b> (default) — HMAC-SHA256 symmetric signing. Requires <see cref="Key"/>.</description></item>
///   <item><description><b>RS256</b> — RSA-SHA256 asymmetric signing. Requires <see cref="PrivateKeyPath"/> and <see cref="PublicKeyPath"/>.</description></item>
/// </list>
/// </summary>
public record JwtOptions
{
    /// <summary>
    /// Configuration section key used to bind this record from <c>appsettings.json</c>.
    /// </summary>
    public const string Jwt = nameof(Jwt);

    /// <summary>
    /// Signing algorithm. Valid values: <c>"HS256"</c> (default) or <c>"RS256"</c>.
    /// </summary>
    public string Algorithm { get; set; } = SecurityAlgorithms.HmacSha256;

    /// <summary>
    /// Expected issuer claim (<c>iss</c>) embedded in and validated from every JWT.
    /// </summary>
    public string Issuer { get; set; } = string.Empty;

    /// <summary>
    /// Expected audience claim (<c>aud</c>) embedded in and validated from every JWT.
    /// </summary>
    public string Audience { get; set; } = string.Empty;

    /// <summary>
    /// Symmetric shared secret used to sign and verify tokens when <see cref="Algorithm"/> is <c>"HS256"</c>.
    /// Not used for RS256.
    /// </summary>
    public string Key { get; set; } = string.Empty;

    /// <summary>
    /// Absolute or relative path to the PEM-encoded RSA <b>private</b> key file used to <em>sign</em> tokens
    /// when <see cref="Algorithm"/> is <c>"RS256"</c>. Not used for HS256.
    /// </summary>
    public string PrivateKeyPath { get; set; } = string.Empty;

    /// <summary>
    /// Absolute or relative path to the PEM-encoded RSA <b>public</b> key file used to <em>verify</em> tokens
    /// when <see cref="Algorithm"/> is <c>"RS256"</c>. Not used for HS256.
    /// </summary>
    public string PublicKeyPath { get; set; } = string.Empty;

    /// <summary>
    /// The <see cref="SecurityKey"/> used to sign tokens when issuing tokens.
    /// </summary>
    public SecurityKey SigningSecurityKey { get; set; } = null!;

    /// <summary>
    /// The <see cref="SecurityKey"/> used to verify tokens when validating incoming tokens.
    /// </summary>
    public SecurityKey VerificationSecurityKey { get; set; } = null!;
}