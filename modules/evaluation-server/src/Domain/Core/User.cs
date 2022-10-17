#nullable disable

namespace Domain.Core;

public class User
{
    public string KeyId { get; set; }

    public string Name { get; set; }

    public List<CustomizedProperty> CustomizedProperties { get; set; } = new();
}

public class CustomizedProperty
{
    public string Name { get; set; }

    public string Value { get; set; }
}