using System.ComponentModel.DataAnnotations;

namespace Application.Cloud;

public class CloudOptions
{
    public const string Cloud = nameof(Cloud);

    [Required(ErrorMessage = "Cloud Service Url must be set.")]
    public string ServiceUrl { get; set; } = string.Empty;

    [Required(ErrorMessage = "Cloud Service API key must be set.")]
    public string ServiceApiKey { get; set; } = string.Empty;
}