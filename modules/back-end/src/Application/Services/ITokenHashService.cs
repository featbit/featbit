namespace Application.Services;

public interface ITokenHashService
{
    string GenerateToken();
    
    string HashToken(string token);
}