namespace Domain.EndUsers;

public class EndUserProperty : AuditedEntity
{
    public Guid EnvId { get; set; }

    public string Name { get; set; }

    public ICollection<EndUserPresetValue> PresetValues { get; set; }

    public bool UsePresetValuesOnly { get; set; }

    public bool IsBuiltIn { get; set; }

    public bool IsDigestField { get; set; }

    public string Remark { get; set; }

    public EndUserProperty(
        Guid envId,
        string name,
        ICollection<EndUserPresetValue> presetValues = null,
        bool usePresetValuesOnly = false,
        // built in properties are defined in EndUserConsts.BuiltInProperties
        bool isBuiltIn = false,
        bool isDigestField = false,
        string remark = "")
    {
        EnvId = envId;
        Name = name;
        PresetValues = presetValues ?? Array.Empty<EndUserPresetValue>();
        UsePresetValuesOnly = usePresetValuesOnly;
        IsBuiltIn = isBuiltIn;
        IsDigestField = isDigestField;
        Remark = remark;
    }

    public void Update(EndUserProperty other)
    {
        Name = other.Name;
        PresetValues = other.PresetValues ?? Array.Empty<EndUserPresetValue>();
        UsePresetValuesOnly = other.UsePresetValuesOnly;
        IsDigestField = other.IsDigestField;
        Remark = other.Remark ?? string.Empty;

        UpdatedAt = DateTime.UtcNow;
    }
}