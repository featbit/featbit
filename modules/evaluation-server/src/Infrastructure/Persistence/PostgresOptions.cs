using System.ComponentModel.DataAnnotations;

namespace Infrastructure.Persistence;

public class PostgresOptions
{
    public const string Postgres = nameof(Postgres);

    [Required(ErrorMessage = "Postgres connection string must be set.")]
    public string ConnectionString { get; set; } = string.Empty;
}