namespace Domain.Organizations;

public record ScopeString
{
    public Guid ProjectId { get; } = Guid.Empty;

    public Guid[] EnvIds { get; } = [];

    public ScopeString(string str)
    {
        var split = str.Split('/');
        if (split.Length != 2)
        {
            return;
        }

        ProjectId = Guid.Parse(split[0]);
        EnvIds = split[1].Split(',').Select(Guid.Parse).ToArray();
    }
}