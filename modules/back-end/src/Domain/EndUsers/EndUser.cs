using System.Text;

namespace Domain.EndUsers;

public class EndUser : AuditedEntity
{
    public Guid? WorkspaceId { get; set; }

    public Guid? EnvId { get; set; }

    public string KeyId { get; set; }

    public string Name { get; set; }

    public ICollection<EndUserCustomizedProperty> CustomizedProperties { get; set; }

    public EndUser(
        Guid? workspaceId,
        Guid? envId,
        string keyId,
        string name,
        ICollection<EndUserCustomizedProperty> customizedProperties)
    {
        WorkspaceId = workspaceId;
        EnvId = envId;
        KeyId = keyId;
        Name = name;
        CustomizedProperties = customizedProperties ?? Array.Empty<EndUserCustomizedProperty>();
    }

    public void Update(string name, ICollection<EndUserCustomizedProperty> customizedProperties)
    {
        Name = name;
        CustomizedProperties = customizedProperties ?? Array.Empty<EndUserCustomizedProperty>();

        UpdatedAt = DateTime.UtcNow;
    }

    public bool ValueEquals(EndUser other)
    {
        if (other == null)
        {
            return false;
        }

        var strEquals = ToString() == other.ToString();
        return strEquals;
    }

    public string ValueOf(string property)
    {
        if (string.IsNullOrWhiteSpace(property))
        {
            return string.Empty;
        }

        if (property == EndUserConsts.KeyId)
        {
            return KeyId;
        }

        if (property == EndUserConsts.Name)
        {
            return Name;
        }

        var value = CustomizedProperties?.FirstOrDefault(x => x.Name == property);
        return value?.Value ?? string.Empty;
    }

    public override string ToString()
    {
        var sb = new StringBuilder();
        sb.Append($"workspaceId:{WorkspaceId},envId:{EnvId},keyId:{KeyId},name:{Name}");

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