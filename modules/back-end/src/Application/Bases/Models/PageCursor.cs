namespace Application.Bases.Models;

public static class PageCursorDirection
{
    public const string Forward = "forward";
    public const string Backward = "backward";
}

public record PageCursor(Guid Id, DateTime UpdatedAt, string Direction);