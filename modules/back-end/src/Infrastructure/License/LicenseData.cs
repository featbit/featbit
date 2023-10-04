namespace Infrastructure.License;

public class LicenseData
{
    public string Plan { get; set; }
    
    public Guid Org { get; set; }
    
    public bool Sso { get; set; }

    public long Exp { get; set; }
}