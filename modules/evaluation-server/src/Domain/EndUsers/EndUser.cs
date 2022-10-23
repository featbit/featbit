#nullable disable

namespace Domain.EndUsers;

public class EndUser
{
    public string KeyId { get; set; }

    public string Name { get; set; }

    public CustomizedProperty[] CustomizedProperties { get; set; } = Array.Empty<CustomizedProperty>();

    public bool IsValid()
    {
        return !string.IsNullOrWhiteSpace(KeyId);
    }
}

public class CustomizedProperty
{
    public string Name { get; set; }

    public string Value { get; set; }
}