using System.ComponentModel.DataAnnotations;

namespace Domain.Evaluation;

public class Variation
{
    [RegularExpression("^[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}$")]
    public string Id { get; set; }

    public string Value { get; set; }

    public Variation(string id, string value)
    {
        Id = id;
        Value = value;
    }

    public static readonly Variation Empty = new(string.Empty, string.Empty);
}