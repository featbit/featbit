namespace Application.Bases.Exceptions;

public class BusinessException : Exception
{
    public BusinessException(string errorCode) : base(errorCode)
    {
    }
}