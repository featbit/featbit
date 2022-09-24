namespace Application.Bases.Exceptions;

public class EntityNotFoundException : Exception
{
    public EntityNotFoundException(string resource, string key)
        : base($"resource \"{resource}\" ({key}) was not found.")
    {
    }
}