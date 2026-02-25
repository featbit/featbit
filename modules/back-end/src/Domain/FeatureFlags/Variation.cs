namespace Domain.FeatureFlags;

public class Variation
{
    /// <summary>
    /// The unique identifier for the variation. Usually a GUID.
    /// </summary>
    public string Id { get; set; }

    /// <summary>
    /// The name of the variation.
    /// </summary>
    public string Name { get; set; }

    /// <summary>
    /// The value associated with the variation.
    /// </summary>
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

    public bool ValueEquals(object obj)
    {
        return obj is Variation variation &&
               Id == variation.Id &&
               Name == variation.Name &&
               Value == variation.Value;
    }
}