namespace Domain.EndUsers;

public class EndUserMessage : EndUser
{
    public Guid EnvId { get; set; }

    public EndUserMessage(Guid envId, EndUser user)
    {
        EnvId = envId;

        KeyId = user.KeyId ?? "";
        Name = user.Name ?? "";
        CustomizedProperties = user.CustomizedProperties ?? [];
    }
}