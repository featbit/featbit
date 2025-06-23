namespace Domain.RelayProxies;

public class AutoAgent
{
    public string Id { get; set; }

    public string Name { get; set; }

    public bool IsValid()
    {
        return !string.IsNullOrWhiteSpace(Id) &&
               !string.IsNullOrWhiteSpace(Name);
    }
}