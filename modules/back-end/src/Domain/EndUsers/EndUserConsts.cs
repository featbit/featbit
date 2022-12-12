namespace Domain.EndUsers;

public class EndUserConsts
{
    public const string KeyId = "keyId";

    public const string Name = "name";

    public static readonly string[] BuiltInProperties = { KeyId, Name };

    public static IEnumerable<EndUserProperty> BuiltInUserProperties(Guid envId)
    {
        var keyId = new EndUserProperty(
            envId,
            KeyId,
            Array.Empty<EndUserPresetValue>(),
            isBuiltIn: true, isDigestField: true, remark: "user identifier in this environment"
        );

        var name = new EndUserProperty(
            envId,
            Name,
            Array.Empty<EndUserPresetValue>(),
            isBuiltIn: true
        );

        return new[] { keyId, name };
    }
}