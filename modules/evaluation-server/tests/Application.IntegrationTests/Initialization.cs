using System.Runtime.CompilerServices;

namespace Application.IntegrationTests;

public static class Initialization
{
    [ModuleInitializer]
    public static void Run()
    {
        DerivePathInfo((_, projectDirectory, type, method) => new PathInfo(
            directory: Path.Combine(projectDirectory, "Snapshots"),
            typeName: type.Name,
            methodName: method.Name)
        );
    }
}