namespace Domain.Organizations;

public class Organization
{
    public string Id { get; set; }

    public string Name { get; set; }

    public bool Initialized { get; set; }
    
    public Subscription Subscription { get; set; }
    
    public DateTime CreatedAt { get; set; }

    public DateTime? UpdatedAt { get; set; }

    public Organization(string name)
    {
        Id = Guid.NewGuid().ToString();
        Name = name;
        Initialized = false;
        Subscription = new Subscription(SubscriptionTypes.Level100);
        
        CreatedAt = DateTime.UtcNow;
    }
}