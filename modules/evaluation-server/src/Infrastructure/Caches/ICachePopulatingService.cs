namespace Infrastructure.Caches;

public interface ICachePopulatingService
{
    Task PopulateAsync();
}