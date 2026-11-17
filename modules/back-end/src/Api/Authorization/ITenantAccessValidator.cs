namespace Api.Authorization;

public interface ITenantAccessValidator
{
    Task<bool> ValidateAsync(HttpContext context);
}
