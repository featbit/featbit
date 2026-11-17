namespace Api.Setup.OpenApi;

[AttributeUsage(AttributeTargets.Method)]
public sealed class OpenApiRequestExamplesAttribute(Type providerType) : Attribute
{
    public Type ProviderType { get; } = providerType;
}
