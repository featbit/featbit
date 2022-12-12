namespace Domain.AuditLogs;

public class Operations
{
    public const string Create = nameof(Create);
    public const string Update = nameof(Update);
    public const string Archive = nameof(Archive);
    public const string Restore = nameof(Restore);
    public const string Remove = nameof(Remove);

    public static readonly string[] All = { Create, Update, Archive, Restore, Remove };

    public static bool IsDefined(string type)
    {
        return All.Contains(type);
    }
}