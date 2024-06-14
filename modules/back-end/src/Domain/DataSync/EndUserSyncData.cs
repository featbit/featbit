using Domain.EndUsers;

namespace Domain.DataSync;

public class EndUserSyncData
{
    public string KeyId { get; set; }

    public string Name { get; set; }

    public ICollection<EndUserCustomizedProperty> CustomizedProperties { get; set; }
}