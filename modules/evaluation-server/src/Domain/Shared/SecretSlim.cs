namespace Domain.Shared;

public record SecretSlim(Guid EnvId, string Type, string Value);