namespace Domain.Webhooks;

public static class PayloadTemplateType
{
    public const string Default = "default";
    public const string Custom = "custom";

    public static readonly string[] All = { Default, Custom };
}