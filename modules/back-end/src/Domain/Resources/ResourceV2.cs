namespace Domain.Resources;

public class ResourceV2
{
    public Guid Id { get; set; }

    public string Name { get; set; }

    public string PathName { get; set; }

    public string Rn { get; set; }

    public string Type { get; set; }

    public static readonly ResourceV2 All = new()
    {
        Id = new Guid("2bdcb290-2e1b-40d7-bdd1-697fb2193292"),
        Name = "All",
        PathName = "All",
        Rn = "*",
        Type = ResourceTypes.All
    };

    public static readonly ResourceV2 AllOrganizations = new()
    {
        Id = new Guid("e394832e-bd98-43de-b174-e0c98e03d19d"),
        Name = "All Organizations",
        PathName = "All Organizations",
        Rn = "organization/*",
        Type = ResourceTypes.Organization
    };

    public static readonly ResourceV2 AllIam = new()
    {
        Id = new Guid("d8791bd2-ca85-4629-a439-1dce20764211"),
        Name = "All IAM",
        PathName = "All IAM",
        Rn = "organization/*:iam/*",
        Type = ResourceTypes.Iam
    };

    public static readonly ResourceV2 AllAccessToken = new()
    {
        Id = new Guid("150083da-e20f-4670-948c-b842cf8a91a4"),
        Name = "All Access Tokens",
        PathName = "All Access Tokens",
        Rn = "organization/*:access-token/*",
        Type = ResourceTypes.AccessToken
    };

    public static readonly ResourceV2 AllRelayProxies = new()
    {
        Id = new Guid("fef122fb-0b20-4556-b830-5863850e8092"),
        Name = "All Relay Proxies",
        PathName = "All Relay Proxies",
        Rn = "organization/*:relay-proxy/*",
        Type = ResourceTypes.RelayProxy
    };

    public static readonly ResourceV2 AllProject = new()
    {
        Id = new Guid("e77679a2-e79b-43e5-aa9f-fd6c980239be"),
        Name = "All Projects",
        PathName = "All Projects",
        Rn = "organization/*:project/*",
        Type = ResourceTypes.Project
    };

    public static readonly ResourceV2 AllProjectEnv = new()
    {
        Id = new Guid("c62ed37a-74a9-4987-8ef4-b5a16127f307"),
        Name = "All Environments",
        PathName = "All Environments",
        Rn = "organization/*:project/*:env/*",
        Type = ResourceTypes.Env
    };

    public static readonly ResourceV2 AllFeatureFlag = new()
    {
        Id = new Guid("cc97e362-9688-44b6-9532-2f82f19e1316"),
        Name = "All Feature Flags",
        PathName = "All Feature Flags",
        Rn = "organization/*:project/*:env/*:flag/*",
        Type = ResourceTypes.FeatureFlag
    };

    public static readonly ResourceV2 AllSegments = new()
    {
        Id = new Guid("f03a822a-047f-11ee-be56-0242ac120002"),
        Name = "All Segments",
        PathName = "All Segments",
        Rn = "organization/*:project/*:env/*:segment/*",
        Type = ResourceTypes.Segment
    };
}