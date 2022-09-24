namespace Domain.Organizations;

public class Subscription
{
    public string Id { get; set; }

    public string Type { get; set; }

    public Subscription(string type)
    {
        Id = Guid.NewGuid().ToString();
        Type = type;
    }
}

public class SubscriptionTypes
{
    // basic
    public const string Level100 = "L100";

    // team
    public const string Level200 = "L200";

    // enterprise
    public const string Level300 = "L300";
}