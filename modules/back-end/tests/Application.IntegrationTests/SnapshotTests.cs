using System.Net;
using System.Text;
using System.Text.Json.Nodes;

namespace Application.IntegrationTests;

// Tests for the Snapshot helper in TestBase. Each test uses its own snapshot name, so the files it
// writes to the Snapshots folder don't clash with other tests and are removed afterwards.
public class SnapshotTests : IDisposable
{
    private const string SourceFile = "SnapshotTests.cs";

    private readonly string _testName = $"Self_{Guid.NewGuid():N}";
    private readonly string _verifiedPath;
    private readonly string _receivedPath;

    public SnapshotTests()
    {
        var directory = Path.Combine(ProjectDirectory(), "Snapshots");
        _verifiedPath = Path.Combine(directory, $"SnapshotTests.{_testName}.verified.json");
        _receivedPath = Path.Combine(directory, $"SnapshotTests.{_testName}.received.json");
    }

    public void Dispose()
    {
        File.Delete(_verifiedPath);
        File.Delete(_receivedPath);
    }

    [Fact]
    public async Task Match_NoVerifiedFile_WritesReceivedFileAndFails()
    {
        var exception = await Assert.ThrowsAsync<SnapshotMismatchException>(
            () => Snapshot.Match(new { Name = "value" }, sourceFile: SourceFile, testName: _testName)
        );

        Assert.Contains("has no verified file yet", exception.Message);
        Assert.Equal("{\n  \"Name\": \"value\"\n}\n", File.ReadAllText(_receivedPath));
    }

    [Fact]
    public async Task Match_VerifiedFileDiffers_WritesReceivedFileAndFails()
    {
        File.WriteAllText(_verifiedPath, "{\n  \"Name\": \"expected\"\n}\n");

        var exception = await Assert.ThrowsAsync<SnapshotMismatchException>(
            () => Snapshot.Match(new { Name = "actual" }, sourceFile: SourceFile, testName: _testName)
        );

        Assert.Contains("First difference at line 2", exception.Message);
        Assert.Contains("verified: \"Name\": \"expected\"", exception.Message);
        Assert.Contains("received: \"Name\": \"actual\"", exception.Message);
        Assert.Equal("{\n  \"Name\": \"actual\"\n}\n", File.ReadAllText(_receivedPath));
    }

    [Fact]
    public async Task Match_VerifiedFileMatches_PassesAndDeletesReceivedFile()
    {
        File.WriteAllText(_verifiedPath, "{\r\n  \"Name\": \"value\"\r\n}\r\n");
        File.WriteAllText(_receivedPath, "left over from an earlier run");

        await Snapshot.Match(new { Name = "value" }, sourceFile: SourceFile, testName: _testName);

        Assert.False(File.Exists(_receivedPath));
    }

    [Fact]
    public async Task MatchJson_UnsortedProperties_SortsThemCaseInsensitively()
    {
        Verified("""
                 {
                   "A": 2,
                   "a": 3,
                   "b": {
                     "c": 1,
                     "D": 4
                   }
                 }
                 """);

        await Snapshot.MatchJson(
            """{ "b": { "D": 4, "c": 1 }, "a": 3, "A": 2 }""",
            sourceFile: SourceFile,
            testName: _testName
        );
    }

    [Fact]
    public async Task Match_RepeatedGuidsAndDateTimes_KeepTheirRelationships()
    {
        var first = Guid.NewGuid();
        var second = Guid.NewGuid();
        var value = new JsonObject
        {
            ["a"] = first.ToString(),
            ["b"] = second.ToString(),
            ["c"] = first.ToString(),
            ["d"] = "2024-01-02T03:04:05.678Z",
            ["e"] = "2024-01-02T03:04:05",
            ["f"] = "2024-01-02T03:04:05.678Z",
            ["g"] = "not a guid or a date"
        };
        Verified("""
                 {
                   "a": "Guid_1",
                   "b": "Guid_2",
                   "c": "Guid_1",
                   "d": "DateTimeOffset_1",
                   "e": "DateTime_1",
                   "f": "DateTimeOffset_1",
                   "g": "not a guid or a date"
                 }
                 """);

        await Snapshot.Match(value, sourceFile: SourceFile, testName: _testName);
    }

    [Fact]
    public async Task Match_Scrub_AppliesToEveryStringValue()
    {
        Verified("""
                 {
                   "Items": [
                     "[Scrubbed]",
                     "kept"
                   ],
                   "Token": "[Scrubbed]"
                 }
                 """);

        await Snapshot.Match(
            new { Token = "secret-1", Items = new[] { "secret-22", "kept" } },
            scrub: x => x.StartsWith("secret-") ? "[Scrubbed]" : x,
            sourceFile: SourceFile,
            testName: _testName
        );
    }

    [Fact]
    public async Task Match_HttpResponse_WritesStatusHeadersAndContentWithoutCookiesOrLength()
    {
        using var response = new HttpResponseMessage(HttpStatusCode.OK);
        response.Content = new StringContent("""{ "b": 1, "a": "x" }""", Encoding.UTF8, "application/json");
        response.Headers.Add("Set-Cookie", "session=abc");
        response.Headers.Add("X-Test", "1");
        Assert.NotNull(response.Content.Headers.ContentLength);
        Verified("""
                 {
                   "Content": {
                     "Headers": {
                       "Content-Type": "application/json; charset=utf-8"
                     },
                     "Value": {
                       "a": "x",
                       "b": 1
                     }
                   },
                   "Headers": {
                     "X-Test": "1"
                   },
                   "Status": "200 OK"
                 }
                 """);

        await Snapshot.Match(response, sourceFile: SourceFile, testName: _testName);
    }

    private void Verified(string json) => File.WriteAllText(_verifiedPath, json);

    private static string ProjectDirectory()
    {
        var directory = new DirectoryInfo(AppContext.BaseDirectory);
        while (directory.GetFiles("*.csproj").Length == 0)
        {
            directory = directory.Parent!;
        }

        return directory.FullName;
    }
}
