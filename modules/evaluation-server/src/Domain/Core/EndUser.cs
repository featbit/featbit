#nullable disable

namespace Domain.Core;

public class EndUser
{
    public string KeyId { get; set; }

    public string Name { get; set; }

    public List<CustomizedProperty> CustomizedProperties { get; set; } = new();

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