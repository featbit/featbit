using System.Security.Claims;
using System.Text.Json.Serialization;
using Application.Bases.Models;
using Application.Services;
using Api.Mcp;
using Domain.Mcp;
using Domain.Policies;
using Domain.Users;
using Infrastructure.Identity;
using Microsoft.IdentityModel.JsonWebTokens;
using Microsoft.IdentityModel.Tokens;

namespace Api.Controllers;

[Route("api/v{version:apiVersion}/mcp/oauth")]
public class McpOAuthController(
    IMcpAuthorizationStore store,
    IEnvironmentService environmentService,
    IOrganizationService organizationService,
    JwtOptions jwtOptions)
    : ApiControllerBase
{
    private const int PollIntervalSeconds = 5;
    private const int TokenLifetimeDays = 30;
    private const string McpScope = "experiment:read experiment:write experiment:analyze";

    [HttpPost("device/code")]
    [AllowAnonymous]
    public async Task<ActionResult<McpDeviceCodeResponse>> CreateDeviceCode(McpDeviceCodeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ClientId))
        {
            return BadRequest(new McpOAuthError("invalid_request", "clientId is required."));
        }

        if (request.EnvId == Guid.Empty)
        {
            return BadRequest(new McpOAuthError("invalid_request", "envId is required."));
        }

        var (authorization, deviceCode) = await store.CreateDeviceAuthorizationAsync(
            request.ClientId,
            request.EnvId,
            request.ExperimentId);
        var verificationUri = $"{Request.Scheme}://{Request.Host}/mcp/oauth/device";

        return new McpDeviceCodeResponse(
            deviceCode,
            authorization.UserCode,
            verificationUri,
            (int)(authorization.ExpiresAt - DateTime.UtcNow).TotalSeconds,
            PollIntervalSeconds);
    }

    [HttpPost("token")]
    [AllowAnonymous]
    public async Task<ActionResult<McpTokenResponse>> ExchangeToken(McpTokenRequest request)
    {
        if (request.GrantType == "refresh_token")
        {
            return await RefreshAccessToken(request);
        }

        if (request.GrantType != "urn:ietf:params:oauth:grant-type:device_code")
        {
            return BadRequest(new McpOAuthError("unsupported_grant_type", "Only device_code and refresh_token grants are supported."));
        }

        if (string.IsNullOrWhiteSpace(request.DeviceCode) || string.IsNullOrWhiteSpace(request.ClientId))
        {
            return BadRequest(new McpOAuthError("invalid_request", "device_code and client_id are required."));
        }

        var authorization = await store.FindDeviceAuthorizationByDeviceCodeAsync(request.DeviceCode);
        if (authorization == null)
        {
            return BadRequest(new McpOAuthError("expired_token", "The device code is expired or invalid."));
        }

        if (!authorization.IsApproved)
        {
            return BadRequest(new McpOAuthError("authorization_pending", "The user has not approved the device code yet."));
        }

        if (authorization.ClientId != request.ClientId)
        {
            return BadRequest(new McpOAuthError("invalid_client", "clientId does not match the device code."));
        }

        var expiresAt = DateTime.UtcNow.AddDays(TokenLifetimeDays);
        var tokenId = await store.CreateAccessTokenSessionAsync(authorization, expiresAt);
        var accessToken = IssueMcpAccessToken(authorization, tokenId, expiresAt);
        var refreshToken = await store.CreateRefreshTokenAsync(authorization);
        await store.RemoveDeviceAuthorizationAsync(authorization);

        return new McpTokenResponse(
            accessToken,
            refreshToken,
            "Bearer",
            TokenLifetimeDays * 24 * 60 * 60,
            McpScope);
    }

    [Authorize(Permissions.CanAccessEnv)]
    [HttpPost("~/api/v{version:apiVersion}/envs/{envId:guid}/release-decision/mcp/oauth/token")]
    public async Task<ActionResult<McpTokenResponse>> CreateScopedToken(
        Guid envId,
        McpScopedTokenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ClientId))
        {
            return BadRequest(new McpOAuthError("invalid_request", "client_id is required."));
        }

        var (organizationId, workspaceId) = await ResolveMcpTokenScopeAsync(envId);
        if (organizationId == Guid.Empty || workspaceId == Guid.Empty)
        {
            return BadRequest(ApiResponse<McpTokenResponse>.Error("missing-workspace-context"));
        }

        var authorization = McpDeviceAuthorization.Create(
            request.ClientId,
            envId,
            request.ExperimentId,
            DateTime.UtcNow.AddMinutes(PollIntervalSeconds)).Authorization;
        authorization.Approve(CurrentUser.Id, organizationId, workspaceId);

        var expiresAt = DateTime.UtcNow.AddDays(TokenLifetimeDays);
        var tokenId = await store.CreateAccessTokenSessionAsync(authorization, expiresAt);
        var accessToken = IssueMcpAccessToken(authorization, tokenId, expiresAt);
        var refreshToken = await store.CreateRefreshTokenAsync(authorization);

        return new McpTokenResponse(
            accessToken,
            refreshToken,
            "Bearer",
            TokenLifetimeDays * 24 * 60 * 60,
            McpScope);
    }

    [Authorize(Permissions.CanAccessEnv)]
    [HttpPost("~/api/v{version:apiVersion}/envs/{envId:guid}/release-decision/mcp/oauth/device/authorize")]
    public async Task<ActionResult<ApiResponse<McpDeviceAuthorizeResponse>>> AuthorizeDeviceCode(
        Guid envId,
        McpDeviceAuthorizeRequest request)
    {
        var authorization = await store.FindDeviceAuthorizationByUserCodeAsync(request.UserCode);
        if (authorization == null)
        {
            return BadRequest(ApiResponse<McpDeviceAuthorizeResponse>.Error("invalid-device-code"));
        }

        if (authorization.EnvId != envId)
        {
            return Forbid();
        }

        var (organizationId, workspaceId) = await ResolveMcpTokenScopeAsync(envId);
        if (organizationId == Guid.Empty || workspaceId == Guid.Empty)
        {
            return BadRequest(ApiResponse<McpDeviceAuthorizeResponse>.Error("missing-workspace-context"));
        }

        await store.ApproveDeviceAuthorizationAsync(authorization, CurrentUser.Id, organizationId, workspaceId);

        return Ok(new McpDeviceAuthorizeResponse(
            authorization.ClientId,
            authorization.EnvId,
            authorization.ExperimentId,
            authorization.ExpiresAt));
    }

    [HttpPost("revoke")]
    [AllowAnonymous]
    public async Task<ActionResult<McpOAuthError?>> RevokeToken(McpTokenRevokeRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.AccessToken))
        {
            return BadRequest(new McpOAuthError("invalid_request", "access_token is required."));
        }

        var tokenId = ReadTokenId(request.AccessToken);
        if (string.IsNullOrWhiteSpace(tokenId))
        {
            return BadRequest(new McpOAuthError("invalid_token", "The access token is malformed."));
        }

        await store.RevokeAccessTokenAsync(tokenId);
        return Ok();
    }

    private async Task<ActionResult<McpTokenResponse>> RefreshAccessToken(McpTokenRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken) || string.IsNullOrWhiteSpace(request.ClientId))
        {
            return BadRequest(new McpOAuthError("invalid_request", "refresh_token and client_id are required."));
        }

        var rotated = await store.RotateRefreshTokenAsync(request.RefreshToken, request.ClientId);
        if (rotated == null)
        {
            return BadRequest(new McpOAuthError("invalid_grant", "The refresh token is expired or invalid."));
        }

        var (refreshToken, authorization) = rotated.Value;
        var expiresAt = DateTime.UtcNow.AddDays(TokenLifetimeDays);
        var tokenId = await store.CreateAccessTokenSessionAsync(authorization, expiresAt);
        var accessToken = IssueMcpAccessToken(authorization, tokenId, expiresAt);

        return new McpTokenResponse(
            accessToken,
            refreshToken,
            "Bearer",
            TokenLifetimeDays * 24 * 60 * 60,
            McpScope);
    }

    private string IssueMcpAccessToken(McpDeviceAuthorization authorization, string tokenId, DateTime expiresAt)
        => IssueMcpAccessToken(
            authorization.ApprovedUserId!.Value,
            authorization.ApprovedOrganizationId!.Value,
            authorization.ApprovedWorkspaceId!.Value,
            tokenId,
            expiresAt);

    private string IssueMcpAccessToken(McpRefreshAuthorization authorization, string tokenId, DateTime expiresAt)
        => IssueMcpAccessToken(
            authorization.UserId,
            authorization.OrganizationId,
            authorization.WorkspaceId,
            tokenId,
            expiresAt);

    private async Task<(Guid OrganizationId, Guid WorkspaceId)> ResolveMcpTokenScopeAsync(Guid envId)
    {
        var organizationId = Request.OrganizationId();
        var workspaceId = Request.WorkspaceId();
        if (organizationId != Guid.Empty && workspaceId != Guid.Empty)
        {
            return (organizationId, workspaceId);
        }

        var descriptor = await environmentService.GetResourceDescriptorAsync(envId);
        if (descriptor == null)
        {
            return (Guid.Empty, Guid.Empty);
        }

        var organization = await organizationService.GetAsync(descriptor.Organization.Id);
        return (
            organization.Id,
            organization.WorkspaceId);
    }

    private string IssueMcpAccessToken(
        Guid userId,
        Guid organizationId,
        Guid workspaceId,
        string tokenId,
        DateTime expiresAt)
    {
        var credentials = new SigningCredentials(jwtOptions.SigningSecurityKey, jwtOptions.Algorithm);

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Jti, tokenId),
            new(UserClaims.Id, userId.ToString()),
            new(McpClaimTypes.TokenType, McpClaimTypes.McpTokenType),
            new(McpClaimTypes.OrgId, organizationId.ToString()),
            new(McpClaimTypes.WorkspaceId, workspaceId.ToString()),
            new(McpClaimTypes.Scope, McpScope)
        };

        var descriptor = new SecurityTokenDescriptor
        {
            Issuer = jwtOptions.Issuer,
            Audience = jwtOptions.Audience,
            Expires = expiresAt,
            Subject = new ClaimsIdentity(claims),
            SigningCredentials = credentials
        };

        var handler = new JsonWebTokenHandler();
        return handler.CreateToken(descriptor);
    }

    private static string? ReadTokenId(string accessToken)
    {
        try
        {
            var token = new JsonWebTokenHandler().ReadJsonWebToken(accessToken);
            return token.Claims.FirstOrDefault(x => x.Type == JwtRegisteredClaimNames.Jti)?.Value;
        }
        catch
        {
            return null;
        }
    }
}

public record McpDeviceCodeRequest(
    [property: JsonPropertyName("client_id")]
    string ClientId,
    [property: JsonPropertyName("env_id")]
    Guid EnvId,
    [property: JsonPropertyName("experiment_id")]
    Guid? ExperimentId);

public record McpDeviceCodeResponse(
    [property: JsonPropertyName("device_code")]
    string DeviceCode,
    [property: JsonPropertyName("user_code")]
    string UserCode,
    [property: JsonPropertyName("verification_uri")]
    string VerificationUri,
    [property: JsonPropertyName("expires_in")]
    int ExpiresIn,
    [property: JsonPropertyName("interval")]
    int Interval);

public record McpTokenRequest(
    [property: JsonPropertyName("grant_type")]
    string GrantType,
    [property: JsonPropertyName("device_code")]
    string? DeviceCode,
    [property: JsonPropertyName("client_id")]
    string? ClientId,
    [property: JsonPropertyName("refresh_token")]
    string? RefreshToken);

public record McpScopedTokenRequest(
    [property: JsonPropertyName("client_id")]
    string ClientId,
    [property: JsonPropertyName("experiment_id")]
    Guid? ExperimentId);

public record McpTokenRevokeRequest(
    [property: JsonPropertyName("access_token")]
    string AccessToken);

public record McpTokenResponse(
    [property: JsonPropertyName("access_token")]
    string AccessToken,
    [property: JsonPropertyName("refresh_token")]
    string RefreshToken,
    [property: JsonPropertyName("token_type")]
    string TokenType,
    [property: JsonPropertyName("expires_in")]
    int ExpiresIn,
    [property: JsonPropertyName("scope")]
    string Scope);

public record McpDeviceAuthorizeRequest(
    [property: JsonPropertyName("user_code")]
    string UserCode);

public record McpDeviceAuthorizeResponse(
    [property: JsonPropertyName("client_id")]
    string ClientId,
    [property: JsonPropertyName("env_id")]
    Guid EnvId,
    [property: JsonPropertyName("experiment_id")]
    Guid? ExperimentId,
    [property: JsonPropertyName("expires_at")]
    DateTime ExpiresAt);

public record McpOAuthError(
    [property: JsonPropertyName("error")]
    string Error,
    [property: JsonPropertyName("error_description")]
    string ErrorDescription);
