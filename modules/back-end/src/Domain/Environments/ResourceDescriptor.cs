namespace Domain.Environments;

public record ResourceDescriptor
{
    public IdNameProps Organization { get; init; }

    public IdNameProps Project { get; init; }

    public IdNameProps Environment { get; set; }
}

public record IdNameProps
{
    public Guid Id { get; init; }

    public string Name { get; init; }
}