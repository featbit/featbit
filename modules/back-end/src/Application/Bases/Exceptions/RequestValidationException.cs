using FluentValidation.Results;

namespace Application.Bases.Exceptions;

public class RequestValidationException : Exception
{
    public IDictionary<string, string[]> Errors { get; }

    public RequestValidationException() : base("One or more validation failures have occurred.")
    {
        Errors = new Dictionary<string, string[]>();
    }

    public RequestValidationException(IEnumerable<ValidationFailure> failures) : this()
    {
        Errors = failures
            .GroupBy(e => e.PropertyName, failure => failure.ErrorMessage)
            .ToDictionary(group => group.Key, group => group.ToArray());
    }

    public object ToResponse()
    {
        return new
        {
            Type = "https://tools.ietf.org/html/rfc7231#section-6.5.1",
            Title = Message,
            Errors = Errors
        };
    }
}