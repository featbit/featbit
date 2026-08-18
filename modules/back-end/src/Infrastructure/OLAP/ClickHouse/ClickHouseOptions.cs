using System.ComponentModel.DataAnnotations;

namespace Infrastructure.OLAP.ClickHouse;

public class ClickHouseOptions
{
    public const string ClickHouse = nameof(ClickHouse);

    [Required(ErrorMessage = "ClickHouse HTTP endpoint must be set.")]
    public string HttpEndpoint { get; set; } = string.Empty;

    public string Database { get; set; } = "featbit";

    public string User { get; set; } = "default";

    public string Password { get; set; } = string.Empty;
}
