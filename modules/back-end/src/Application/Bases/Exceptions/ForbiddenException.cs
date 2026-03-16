namespace Application.Bases.Exceptions;

public class ForbiddenException : Exception
{
    public ForbiddenException() : base("You are not authorized to access this resource.")
    {
    }
}