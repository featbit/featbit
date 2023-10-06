namespace Application.License;

public class LicenseData
{
    public string Plan { get; set; }
    
    public string Sub { get; set; }

    public Guid OrgId { get; set; }
    
    public long Iat { get; set; }
    
    public long Exp { get; set; }
    
    public string Issuer { get; set; }

    public ICollection<string> Features { get; set; }
    
    public bool IsGranted(string feature)
    {
        return Features.Contains(feature);
    }
}