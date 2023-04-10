namespace Application.Caches;

public interface ICachePopulatingService
{
    Task PopulateAsync();
}