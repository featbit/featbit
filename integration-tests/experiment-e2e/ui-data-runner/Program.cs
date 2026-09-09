using UiExperimentData;
using System.Text.Json;

try
{
    var cli = Cli.Parse(args);
    if (cli.Action == "help")
    {
        Console.WriteLine("""
            FeatBit UI experiment data runner (.NET SDK 1.2.11)
            --action help|plan|preflight|inject|verify
            --session-id <unique-id>                 required for preflight/inject/verify
            --case <case-id> --batch <batch-id>       required for inject/verify
            verify compares ingested data with the per-user ledger.
            --config <local.json> --scenarios <json> --report-root <directory>
            Credentials: FEATBIT_UI_ACCESS_TOKEN or FEATBIT_UI_LOGIN_EMAIL/LOGIN_PASSWORD.
            PowerShell entry reads ui-data-runner/config.local.json by default; copy config.example.json and set current local endpoints.
            FEATBIT_UI_CONFIG or -Config overrides that path; credentials stay in process environment variables.
            UI procedure: integration-tests/experiment-e2e/UI_AUTO_TEST_SCRIPT.md. Analyze and result review happen in the UI.
            Exit: 0 passed; 1 verification failed; 2 precondition; 3 uncertain delivery.
            """);
        return 0;
    }
    var cases = Catalog.Load(cli.Scenarios);
    if (cli.Action == "plan")
    {
        Console.WriteLine(JsonSerializer.Serialize(new { sdk = "FeatBit.ServerSdk/1.2.11", mainUsers = cases.Sum(c => c.MainUsers + c.PhaseAUsers + c.PhaseBUsers), cases }, Json.Options)); return 0;
    }
    var settings = Settings.Load(cli); await new Runner(cli, settings, cases).Execute();
    return 0;
}
catch (Stop e) { Console.Error.WriteLine(e.Message); return e.Code; }
catch (Exception e) when (e is FileNotFoundException or DirectoryNotFoundException or JsonException or ArgumentException)
{ Console.Error.WriteLine("Invalid or missing local input (" + e.GetType().Name + "). Check paths, JSON and command options."); return 2; }
catch (Exception e)
{ Console.Error.WriteLine("Operation failed (" + e.GetType().Name + "). Details omitted to protect credentials; inspect local service logs and the batch receipt. Never replay an uncertain batch."); return 2; }
