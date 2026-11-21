using System.Text.Json;
using System.Text.Json.Serialization;
using Application.Bases;

namespace Application.ObservabilityProviders;

[JsonUnmappedMemberHandling(JsonUnmappedMemberHandling.Disallow)]
public class ObservabilityProviderRequest
{
    [JsonIgnore]
    public Guid OrgId { get; set; }
    [JsonIgnore]
    public Guid ProjectId { get; set; }

    public string Name { get; set; }
    public string ProviderType { get; set; }
    public int ProviderSchemaVersion { get; set; } = 1;
    public JsonElement ProviderConfig { get; set; }
    public JsonElement Authentication { get; set; }
    public JsonElement SecretUpdate { get; set; }
    public long? ExpectedVersion { get; set; }
}

public class ObservabilityProviderRequestValidator : AbstractValidator<ObservabilityProviderRequest>
{
    public ObservabilityProviderRequestValidator()
    {
        RuleFor(x => x.Name)
            .NotEmpty().WithErrorCode(ErrorCodes.Required("name"))
            .MaximumLength(256).WithErrorCode(ErrorCodes.Invalid("name"))
            .Must(name => name?.Any(char.IsControl) != true).WithErrorCode(ErrorCodes.Invalid("name"));

        RuleFor(x => x.ProviderType)
            .Must(type => type is ProviderConfiguration.Prometheus or ProviderConfiguration.AzureMonitor)
            .WithErrorCode(ErrorCodes.Invalid("providerType"));

        RuleFor(x => x.ProviderSchemaVersion)
            .Equal(1).WithErrorCode(ErrorCodes.Invalid("providerSchemaVersion"));
    }
}
