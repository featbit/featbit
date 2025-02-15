namespace Domain.Environments;

public class Secret
{
    public string Id { get; set; }

    public string Name { get; set; }

    public string Type { get; set; }

    public string Value { get; set; }

    // for ef core and System.Text.Json
    public Secret()
    {
    }

    public Secret(Guid envId, string name, string type)
    {
        Id = Guid.NewGuid().ToString("D");
        Name = name;
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