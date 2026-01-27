namespace Api.Authorization;

public interface IResourceNameService
{
    Task<string> GetRnAsync(string resourceType, HttpContext context);
}