using System.Runtime.CompilerServices;
using Api.Setup;

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

        // The trace-id response header is a fresh random value on every request, so it can never
        // match a stored snapshot. Ignore it rather than scrub it: its presence is asserted directly
        // by Api.UnitTests.Setup.TraceResponseHeaderTests, and these snapshots exist to pin response
        // contracts, which the header is deliberately not part of.
        VerifierSettings.IgnoreMember(TraceResponseHeaderExtensions.HeaderName);

        // Sort properties and json objects alphabetically to make the snapshot matching more accurate
        VerifierSettings.SortPropertiesAlphabetically();
        VerifierSettings.SortJsonObjects();

        VerifyHttp.Initialize();
    }
}