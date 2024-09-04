using System.Runtime.CompilerServices;

namespace Application.IntegrationTests;

public static class Initialization
{
    [ModuleInitializer]
    public static void Run()
    {
        Verifier.DerivePathInfo((sourceFile, projectDirectory, type, method) => new PathInfo(
            directory: Path.Combine(projectDirectory, "Snapshots"),
            typeName: type.Name,
            methodName: method.Name)
        );

        VerifierSettings.ScrubLinesWithReplace(
            x => x.StartsWith("eyJ") && x.Split('.').Length == 3 ? "[Scrubbed JWT]" : x
        );
        VerifierSettings.ScrubLinesWithReplace(x => x.StartsWith("Bearer ") ? "Bearer [Scrubbed Token]" : x);

        // needed for errors[]
        VerifierSettings.DontIgnoreEmptyCollections();
        // needed to ignore cookies that could be added along with empty errors[]
        VerifierSettings.IgnoreMember("Cookies");

        // Sort properties and json objects alphabetically to make the snapshot matching more accurate
        VerifierSettings.SortPropertiesAlphabetically();
        VerifierSettings.SortJsonObjects();

        VerifyHttp.Initialize();
    }
}