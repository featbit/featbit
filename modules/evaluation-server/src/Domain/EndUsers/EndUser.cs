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

    public string ValueOf(string property)
    {
        if (string.IsNullOrWhiteSpace(property))
        {
            return string.Empty;
        }

        if (property == "keyId")
        {
            return KeyId;
        }

        if (property == "name")
        {
            return Name;
        }

        var value = CustomizedProperties?.FirstOrDefault(x => x.Name == property);
        return value?.Value ?? string.Empty;
    }
}

public class CustomizedProperty
{
    public string Name { get; set; }

    public string Value { get; set; }
}