namespace Domain.Resources;

public class Resource
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string Rn { get; set; }

    public string Type { get; set; }

    public static readonly Resource All = new()
    {
        Id = new Guid("2bdcb290-2e1b-40d7-bdd1-697fb2193292"),
        Name = "all",
        Rn = "*",
        Type = ResourceTypes.All
    };

    public static readonly Resource AllAccount = new()
    {
        Id = new Guid("e394832e-bd98-43de-b174-e0c98e03d19d"),
        Name = "account",
        Rn = "account/*",
        Type = ResourceTypes.Account
    };

    public static readonly Resource AllIam = new()
    {
        Id = new Guid("d8791bd2-ca85-4629-a439-1dce20764211"),
        Name = "iam",
        Rn = "iam/*",
        Type = ResourceTypes.Iam
    };

    public static readonly Resource AllAccessToken = new()
    {
        Id = new Guid("150083da-e20f-4670-948c-b842cf8a91a4"),
        Name = "access token",
        Rn = "access-token/*",
        Type = ResourceTypes.AccessToken
    };

    public static readonly Resource AllProject = new()
    {
        Id = new Guid("e77679a2-e79b-43e5-aa9f-fd6c980239be"),
        Name = "project",
        Rn = "project/*",
        Type = ResourceTypes.Project
    };

    public static readonly Resource AllProjectEnv = new()
    {
        Id = new Guid("c62ed37a-74a9-4987-8ef4-b5a16127f307"),
        Name = "env",
        Rn = "project/*:env/*",
        Type = ResourceTypes.Env
    };
    
    public static readonly Resource AllFeatureFlag = new()
    {
        Id = new Guid("cc97e362-9688-44b6-9532-2f82f19e1316"),
        Name = "flag",
        Rn = "project/*:env/*:flag/*",
        Type = ResourceTypes.FeatureFlag
    };
}