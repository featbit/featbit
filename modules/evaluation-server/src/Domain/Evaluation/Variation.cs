namespace Domain.Evaluation;

public class Variation
{
    public string Id { get; set; }

    public string Value { get; set; }

    public Variation(string id, string value)
    {
        Id = id;
        Value = value;
    }

    public static readonly Variation Empty = new(string.Empty, string.Empty);

    public bool IsValid() => !string.IsNullOrWhiteSpace(Id) && Value is not null;
}
