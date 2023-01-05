namespace Domain.Environments;

public class Secret
{
    public string Id { get; set; }
    public string Name { get; set; }
    public string Type { get; set; }

    public string Value { get; set; }

    public Secret(Guid envId, string type)
    {
        Id = Guid.NewGuid().ToString();
        Name = type;
        Type = type;
        Value = ValueOf(envId);
    }

    public static string ValueOf(Guid id)
    {
        var header = GuidHelper.Encode(Guid.NewGuid());
        var body = GuidHelper.Encode(id);

        return $"{header}{body}";
    }
}