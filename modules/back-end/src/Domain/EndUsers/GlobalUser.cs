using System.Text;

namespace Domain.EndUsers;

public class GlobalUser : Entity
{
    public Guid WorkspaceId { get; set; }

    public string KeyId { get; set; }

    public string Name { get; set; }

    public ICollection<EndUserCustomizedProperty> CustomizedProperties { get; set; }

    public GlobalUser(
        Guid workspaceId,
        string keyId,
        string name,
        ICollection<EndUserCustomizedProperty> customizedProperties)
    {
        WorkspaceId = workspaceId;
        KeyId = keyId;
        Name = name;
        CustomizedProperties = customizedProperties ?? Array.Empty<EndUserCustomizedProperty>();
    }

    public bool ValueEquals(GlobalUser other)
    {
        if (other == null)
        {
            return false;
        }

        var strEquals = ToString() == other.ToString();
        return strEquals;
    }

    public override string ToString()
    {
        var sb = new StringBuilder();
        sb.Append($"workspaceId:{WorkspaceId},keyId:{KeyId},name:{Name}");

        if (CustomizedProperties != null)
        {
            foreach (var customizedProperty in CustomizedProperties)
            {
                sb.Append($",{customizedProperty.Name}:{customizedProperty.Value}");
            }
        }

        return sb.ToString();
    }
}