namespace Domain.FeatureFlags;

public class Variation
{
    public string Id { get; set; }

    public string Name { get; set; }

    public string Value { get; set; }

    public bool IsValid()
    {
        return !string.IsNullOrWhiteSpace(Id) &&
               !string.IsNullOrWhiteSpace(Name);
    }

    public void Assign(Variation source)
    {
        if (source.Id != Id)
        {
            return;
        }

        Name = source.Name;
        Value = source.Value;
    }
}