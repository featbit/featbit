namespace Domain.EndUsers;

public class ImportUser
{
    public string KeyId { get; set; }

    public string Name { get; set; }

    public ICollection<EndUserCustomizedProperty> CustomizedProperties { get; set; }

    public EndUser AsEndUser(Guid? workspaceId, Guid? envId)
    {
        return new EndUser(workspaceId, envId, KeyId, Name, CustomizedProperties);
    }
}