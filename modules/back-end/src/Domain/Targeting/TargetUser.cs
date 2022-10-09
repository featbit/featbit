namespace Domain.Targeting;

public class TargetUser
{
    public ICollection<string> KeyIds { get; set; }

    public string VariationId { get; set; }
}