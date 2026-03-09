namespace Application.Bases.Models;

public record PageCursor(Guid Id, DateTime UpdatedAt, CursorDirection Direction);