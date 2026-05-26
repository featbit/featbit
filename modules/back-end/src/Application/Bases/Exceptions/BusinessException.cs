namespace Application.Bases.Exceptions;

public class BusinessException : Exception
{
    public BusinessException(string errorCode) : base(errorCode)
    {
    }

    public BusinessException(string errorCode, string message) : base($"{errorCode}: {message}")
    {
    }
}