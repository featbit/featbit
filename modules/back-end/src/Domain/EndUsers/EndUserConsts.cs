namespace Domain.EndUsers;

public class EndUserConsts
{
    public static IEnumerable<EndUserProperty> BuiltInUserProperties(Guid envId)
    {
        var keyId = new EndUserProperty(
            envId,
            "keyId",
            Array.Empty<EndUserPresetValue>(),
            isBuiltIn: true, isDigestField: true, remark: "user identifier in this environment"
        );

        var name = new EndUserProperty(
            envId,
            "name",
            Array.Empty<EndUserPresetValue>(),
            isBuiltIn: true
        );

        return new[] { keyId, name };
    }
}