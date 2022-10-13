using System.Text;

namespace Domain.EndUsers;

public class EndUser : AuditedEntity
{
    public Guid EnvId { get; set; }

    public string KeyId { get; set; }

    public string Name { get; set; }

    public ICollection<EndUserCustomizedProperty> CustomizedProperties { get; set; }

    public EndUser(
        Guid envId,
        string keyId,
        string name,
        ICollection<EndUserCustomizedProperty> customizedProperties)
    {
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

    public override string ToString()
    {
        var sb = new StringBuilder();
        sb.Append($"envId:{EnvId},keyId:{KeyId},name:{Name}");

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