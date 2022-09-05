#nullable disable

namespace Domain;

public class User
{
    public string UserKeyId { get; set; }

    public string UserName { get; set; }

    public string Email { get; set; }

    public string Country { get; set; }

    public List<CustomizedProperty> CustomizedProperties { get; set; } = new();
}

public class CustomizedProperty
{
    public string Name { get; set; }

    public string Value { get; set; }
}