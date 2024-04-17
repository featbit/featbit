namespace Domain.EndUsers;

public class ImportUser
{
    public string KeyId { get; set; }

    public string Name { get; set; }

    public ICollection<EndUserCustomizedProperty> CustomizedProperties { get; set; }

    public EndUser AsEndUser(Guid envId)
    {
        return new EndUser(envId, KeyId, Name, CustomizedProperties);
    }

    public GlobalUser AsGlobalUser(Guid workspaceId)
    {
        return new GlobalUser(workspaceId, KeyId, Name, CustomizedProperties);
    }
}