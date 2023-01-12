namespace Infrastructure.Caches;

public interface IPopulatingService
{
    Task PopulateAsync();
}