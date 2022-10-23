namespace Infrastructure.Caches;

public interface IPopulatingService
{
    Task<bool> PopulateAsync();
}