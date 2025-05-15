namespace Streaming.Connections;

public interface IRequestValidator
{
    Task<ValidationResult> ValidateAsync(ConnectionContext context);
}