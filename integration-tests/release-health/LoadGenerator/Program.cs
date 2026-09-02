using var cancellation = new CancellationTokenSource();
Console.CancelKeyPress += (_, e) => { e.Cancel = true; cancellation.Cancel(); };
using var client = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };
var endpoint = Environment.GetEnvironmentVariable("DEMO_URL") ?? "http://localhost:19180";
await Task.WhenAll(Enumerable.Range(0, 4).Select(async _ =>
{
    while (!cancellation.IsCancellationRequested)
    {
        try { using var response = await client.GetAsync(endpoint + "/checkout", cancellation.Token); }
        catch (HttpRequestException) { /* Service startup or deliberate source failure. */ }
        catch (TaskCanceledException) when (!cancellation.IsCancellationRequested) { }
        await Task.Delay(100, cancellation.Token);
    }
}));
