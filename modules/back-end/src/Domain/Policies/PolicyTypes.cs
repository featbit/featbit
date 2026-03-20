namespace Domain.Policies;

public class PolicyTypes
{
    public const string CustomerManaged = "CustomerManaged";

    public const string SysManaged = "SysManaged";

    public static readonly string[] All = [CustomerManaged, SysManaged];
}