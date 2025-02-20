namespace Infrastructure.Persistence.EntityFrameworkCore;

public class PostgresOptions
{
    public const string Postgres = nameof(Postgres);

    public string ConnectionString { get; set; } = string.Empty;
}