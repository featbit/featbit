namespace Domain.Environments;

public record ResourceDescriptor
{
    public IdNameKeyProps Organization { get; init; }

    public IdNameKeyProps Project { get; init; }

    public IdNameKeyProps Environment { get; set; }
}

public record IdNameKeyProps
{
    public Guid Id { get; init; }

    public string Name { get; init; }

    public string Key { get; init; }
}