namespace Domain.EndUsers;

public class EndUserMessage
{
    public Guid EnvId { get; set; }

    public string KeyId { get; set; }

    public string Name { get; set; }

    public ICollection<EndUserCustomizedProperty> CustomizedProperties { get; set; }

    public EndUser AsEndUser()
    {
        var user = new EndUser(workspaceId: null, EnvId, KeyId, Name, CustomizedProperties);
        return user;
    }
}