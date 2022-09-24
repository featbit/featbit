using System.Runtime.CompilerServices;

namespace Application.IntegrationTests;

public static class Initialization
{
    [ModuleInitializer]
    public static void Run()
    {
        VerifierSettings.DerivePathInfo((sourceFile, projectDirectory, type, method) => new PathInfo(
            directory: Path.Combine(projectDirectory, "Snapshots"),
            typeName: type.Name,
            methodName: method.Name)
        );

        VerifierSettings.ScrubLinesWithReplace(
            x => x.StartsWith("eyJ") && x.Split('.').Length == 3 ? "[Scrubbed JWT]" : x
        );
        VerifierSettings.ScrubLinesWithReplace(x => x.StartsWith("Bearer ") ? "Bearer [Scrubbed Token]" : x);
        
        VerifyHttp.Enable();
    }
}