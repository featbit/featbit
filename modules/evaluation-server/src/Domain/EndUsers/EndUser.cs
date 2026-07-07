#nullable disable

using System.Text.RegularExpressions;

namespace Domain.EndUsers;

public class EndUser
{
    private const int MaxKeyIdLength = 256;
    private const int MaxNameLength = 256;

    public string KeyId { get; set; }

    public string Name { get; set; }

    public CustomizedProperty[] CustomizedProperties { get; set; } = [];

    public bool IsValid()
    {
        if (string.IsNullOrWhiteSpace(KeyId) || KeyId.Length > MaxKeyIdLength)
        {
            return false;
        }

        if (Name is not null && Name.Length > MaxNameLength)
        {
            return false;
        }

        if (CustomizedProperties is not null && CustomizedProperties.Any(x => x is null || !x.IsValid()))
        {
            return false;
        }

        return true;
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
}

public partial class CustomizedProperty
{
    private const int MaxPropertyNameLength = 128;
    private const int MaxPropertyValueLength = 2048;

    [GeneratedRegex(@"^[\w \-\.\:]+$")]
    private static partial Regex PropertyNameRegex();

    public string Name { get; set; }

    public string Value { get; set; }

    public bool IsValid()
    {
        // property name must be non-empty, less than 128 characters,
        // without leading or trailing spaces, and match the regex pattern
        if (string.IsNullOrWhiteSpace(Name) ||
            Name.Length > MaxPropertyNameLength ||
            Name[0] == ' ' || Name[^1] == ' ' ||
            !PropertyNameRegex().IsMatch(Name))
        {
            return false;
        }

        if (Value is not null && Value.Length > MaxPropertyValueLength)
        {
            return false;
        }

        return true;
    }
}