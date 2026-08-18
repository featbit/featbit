namespace Application.Insights;

public class Insight
{
    public string Time { get; set; }
    public ICollection<VariationInsights> Variations { get; set; }
}

public class VariationInsights
{
    public string Id { get; set; }

    public int Val { get; set; }
}
