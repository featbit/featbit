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

        VerifierSettings.DontIgnoreEmptyCollections();
        VerifierSettings.IgnoreMember("Cookies");

        // Sort properties and json objects alphabetically to make the snapshot matching more accurate
        VerifierSettings.SortPropertiesAlphabetically();
        VerifierSettings.SortJsonObjects();

        VerifyHttp.Initialize();
    }
}