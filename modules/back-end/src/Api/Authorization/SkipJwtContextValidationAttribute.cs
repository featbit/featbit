namespace Api.Authorization;

/// <summary>
/// Skips JWT tenant context validation without bypassing authentication or authorization.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class SkipJwtContextValidationAttribute : Attribute;
