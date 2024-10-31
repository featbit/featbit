using Domain.Organizations;

namespace Domain.Environments;

public record ResourceDescriptor
{
    public IdNameKeyProps Organization { get; init; }

    public IdNameKeyProps Project { get; init; }

    public IdNameKeyProps Environment { get; set; }

    public bool MatchScope(string scope)
    {
        var scopeString = new ScopeString(scope);

        return scopeString.ProjectId == Project.Id &&
               scopeString.EnvIds.Any(id => Environment.Id == id);
    }
}

public record IdNameKeyProps
{
    public Guid Id { get; init; }

    public string Name { get; init; }

    public string Key { get; init; }
}