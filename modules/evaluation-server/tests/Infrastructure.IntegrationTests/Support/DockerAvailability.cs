using System.Diagnostics;

namespace Infrastructure.IntegrationTests.Support;

/// <summary>
/// One-shot check for whether a local Docker daemon is reachable.
/// Cached so each test class only pays the cost once per process.
/// </summary>
public static class DockerAvailability
{
    private static readonly Lazy<bool> IsAvailableLazy = new(Probe);

    public static bool IsAvailable => IsAvailableLazy.Value;

    public const string SkipReason =
        "Docker is not available on this machine. Integration tests are local-only; CI excludes Category=Integration.";

    private static bool Probe()
    {
        try
        {
            using var process = Process.Start(new ProcessStartInfo
            {
                FileName = "docker",
                Arguments = "info --format \"{{.ServerVersion}}\"",
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            });

            if (process is null)
            {
                return false;
            }

            if (!process.WaitForExit(TimeSpan.FromSeconds(5)))
            {
                try { process.Kill(entireProcessTree: true); } catch { /* best effort */ }
                return false;
            }

            return process.ExitCode == 0;
        }
        catch
        {
            return false;
        }
    }
}
