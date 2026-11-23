#nullable enable

using System.Text.Json;
using System.Text.Json.Serialization;
using Application.Bases;
using Application.Bases.Exceptions;
using Domain.ReleaseMetricSourceConnections;
using FluentValidation.Results;

namespace Application.ReleaseMetricSourceConnections;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public class TestReleaseMetricSourceConnectionPayload : ReleaseMetricSourceConnectionPayload
{
    public Guid? ConnectionId { get; set; }
}

public record TestReleaseMetricSourceConnection(Guid OrgId, Guid EnvId, TestReleaseMetricSourceConnectionPayload Payload)
    : IRequest<ConnectionTestResult>;

public record ConnectionTestResult(string Status, string? Reason);

public class TestReleaseMetricSourceConnectionHandler(
    IReleaseMetricSourceConnectionService service,
    IReleaseMetricSourceCredentialProtector protector,
    IPrometheusConnectionTester tester,
    ReleaseMetricSourceConnectionAccessGuard accessGuard)
    : IRequestHandler<TestReleaseMetricSourceConnection, ConnectionTestResult>
{
    public async Task<ConnectionTestResult> Handle(TestReleaseMetricSourceConnection request, CancellationToken cancellationToken)
    {
        var scope = await accessGuard.GetEnvironmentAsync(request.OrgId, request.EnvId);
        var payload = request.Payload;
        ReleaseMetricSourceConnection? saved = null;
        if (payload.ConnectionId is { } id)
        {
            saved = await service.FindAsync(request.EnvId, id, cancellationToken)
                ?? throw new EntityNotFoundException(nameof(ReleaseMetricSourceConnection), id.ToString());

            payload.ProviderType ??= saved.ProviderType;
            if (payload.ProviderConfig.ValueKind == JsonValueKind.Undefined)
            {
                payload.ProviderConfig = saved.ConnectionConfiguration.ProviderConfig;
            }
            if (payload.Authentication.ValueKind == JsonValueKind.Undefined)
            {
                payload.Authentication = saved.ConnectionConfiguration.Authentication;
            }
        }

        if (payload.ProviderType != "prometheus-compatible")
        {
            throw Invalid("providerType");
        }
        var endpoint = PrometheusConnectionEndpoint.ReadForTest(payload.ProviderConfig);
        if (!ReleaseMetricSourceConnectionBaseValidator.IsPrometheusAuthentication(payload.Authentication) ||
            (payload.Authentication.TryGetProperty("type", out var type) && type.ValueKind != JsonValueKind.String))
        {
            throw Invalid("authentication");
        }

        var (username, password, bearerToken) = ReleaseMetricSourceCredentialUpdate.ResolveForTest(payload, saved, scope, protector, endpoint);
        return await tester.TestAsync(endpoint, username, password, bearerToken, cancellationToken);
    }

    private static ValidationException Invalid(string field) => new([
        new ValidationFailure(field, "Invalid connection settings") { ErrorCode = ErrorCodes.Invalid(field) }
    ]);
}
