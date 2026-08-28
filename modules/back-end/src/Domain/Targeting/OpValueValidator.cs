using System.Globalization;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace Domain.Targeting;

public static class OpValueValidator
{
    public static bool IsValid(string op, string value)
    {
        return op switch
        {
            // Equality operators, value must be non-null
            OperatorTypes.Equal or OperatorTypes.NotEqual => value != null,

            // Boolean operators, value is always valid
            OperatorTypes.IsTrue or OperatorTypes.IsFalse => true,

            // Numeric operators, value must be a valid number
            OperatorTypes.LessThan or OperatorTypes.BiggerThan or
                OperatorTypes.LessEqualThan or OperatorTypes.BiggerEqualThan => IsNumber(value),

            // Array operators, value must be a valid JSON array of strings
            OperatorTypes.IsOneOf or OperatorTypes.NotOneOf => IsStringArray(value),

            // String operators, value must be a non-empty string
            OperatorTypes.Contains or OperatorTypes.NotContain or
                OperatorTypes.StartsWith or OperatorTypes.EndsWith => !string.IsNullOrWhiteSpace(value),

            // Regex operators, value must be a valid regular expression
            OperatorTypes.MatchRegex or OperatorTypes.NotMatchRegex => IsRegex(value),

            _ => false
        };
    }

    public static bool IsStringArray(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return false;
        }

        try
        {
            using var document = JsonDocument.Parse(value);
            var root = document.RootElement;
            return root.ValueKind == JsonValueKind.Array &&
                   root.EnumerateArray().All(item => item.ValueKind == JsonValueKind.String);
        }
        catch (JsonException)
        {
            return false;
        }
    }

    public static bool IsNumber(string value) =>
        double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out var number) &&
        double.IsFinite(number);

    public static bool IsRegex(string value)
    {
        if (string.IsNullOrEmpty(value))
        {
            return false;
        }

        try
        {
            _ = Regex.IsMatch(string.Empty, value);
            return true;
        }
        catch (ArgumentException)
        {
            return false;
        }
    }
}
