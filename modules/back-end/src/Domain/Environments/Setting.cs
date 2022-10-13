namespace Domain.Environments;

public class Setting
{
    public string Id { get; set; }

    public string Type { get; set; }

    public string Key { get; set; }

    public string Value { get; set; }

    public string Tag { get; set; }

    public string Remark { get; set; }

    public Setting(string id, string type, string key, string value, string tag = "", string remark = "")
    {
        Id = id;
        Type = type;
        Key = key;
        Value = value;
        Tag = tag;
        Remark = remark;
    }

    public override string ToString()
    {
        return $"Type = {Type}, Key = {Key}, Value = {Value}, Tag = {Tag}, Remark = {Remark}";
    }

    public void Update(Setting newSetting)
    {
        if (newSetting.Id != Id)
        {
            return;
        }

        Type = newSetting.Type;
        Key = newSetting.Key;
        Value = newSetting.Value;
        Tag = newSetting.Tag;
        Remark = newSetting.Remark;
    }
}