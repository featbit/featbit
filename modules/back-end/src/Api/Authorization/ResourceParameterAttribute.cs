namespace Api.Authorization;

[AttributeUsage(AttributeTargets.Method | AttributeTargets.Class, AllowMultiple = false)]
public class ResourceParameterAttribute(string parameterName) : Attribute
{
    public string ParameterName { get; } = parameterName;
}