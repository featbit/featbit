namespace Domain.FeatureFlags;

public class Variation
{
    public string Id { get; set; }

    public string Value { get; set; }

    public Variation(string id, string value)
    {
        Id = id;
        Value = value;
    }
}