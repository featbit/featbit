namespace Application.License;

public class LicenseData
{
    public string Plan { get; set; }
    
    public string Sub { get; set; }

    public Guid OrgId { get; set; }
    
    public long Iat { get; set; }
    
    public long Exp { get; set; }
    
    public string Issuer { get; set; }
    
    public bool Sso { get; set; }

    public bool Schedule { get; set; }
}