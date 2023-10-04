namespace Infrastructure.License;

public class LicenseData
{
    public Guid Org { get; set; }
    
    public bool Sso { get; set; }

    public long Exp { get; set; }
}