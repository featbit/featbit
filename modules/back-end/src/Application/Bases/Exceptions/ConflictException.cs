namespace Application.Bases.Exceptions;

public class ConflictException : Exception
{
    public ConflictException(string resource, Guid id)
        : base($"The request could not be completed due to a conflict with the current state of the resource \"{resource}\" ({id}).")
    {
    }
}