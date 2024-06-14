namespace Domain.EndUsers;

public class GlobalUser : Entity
{
    public Guid WorkspaceId { get; set; }

    public Guid? EnvId { get; set; }

    public string KeyId { get; set; }

    public string Name { get; set; }

    public ICollection<EndUserCustomizedProperty> CustomizedProperties { get; set; }
}