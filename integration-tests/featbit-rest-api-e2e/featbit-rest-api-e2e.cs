#:package FeatBit.ServerSdk@1.2.11

#pragma warning disable IL2026, IL3050

using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using System.Text.Json.Nodes;
using System.Text.RegularExpressions;
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Evaluation;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

AppContext.SetSwitch("System.Text.Json.JsonSerializer.IsReflectionEnabledByDefault", true);

if (args.Any(x => x is "--help" or "-h"))
{
    E2EOptions.PrintUsage();
    return;
}

if (args.Any(x => x is "--self-check"))
{
    await RunSelfCheckAsync(args);
    return;
}

if (args.Any(x => x is "--print-plan"))
{
    PrintPlan(args);
    return;
}

if (args.Any(x => x is "--openapi-preflight"))
{
    await RunOpenApiPreflightAsync(args);
    return;
}

var options = E2EOptions.Parse(args);
options = await ResolveAccessTokenAsync(options);
Directory.CreateDirectory(options.ReportDir);

var report = new TestReport(options);
var api = new FeatBitApiClient(options, report);
var run = new E2ERun(options);

try
{
    await ExecuteAsync(api, report, run, options);
    report.Pass("E2E completed", "All mandatory steps passed.");
}
catch (Exception ex)
{
    report.Fail("E2E failed", ex.ToString());
    Environment.ExitCode = 1;
}
finally
{
    if (options.Cleanup && run.CreatedProject && !string.IsNullOrWhiteSpace(run.ProjectId))
    {
        try
        {
            await api.SendAsync(
                HttpMethod.Delete,
                $"/api/v1/projects/{run.ProjectId}",
                null,
                "Cleanup project",
                "Delete the generated project because --cleanup true was used.");
        }
        catch (Exception ex)
        {
            report.Fail("Cleanup project", ex.Message);
            Environment.ExitCode = 1;
        }
    }

    var (markdown, json) = await report.WriteAsync(run);
    Console.WriteLine($"Report markdown: {markdown}");
    Console.WriteLine($"Report json: {json}");
}

static async Task ExecuteAsync(FeatBitApiClient api, TestReport report, E2ERun run, E2EOptions options)
{
    if (run.UseExistingProjectEnv)
    {
        await UseExistingProjectAndEnvironmentAsync(api, report, run);
    }
    else
    {
        await CreateProjectAndEnvironmentAsync(api, report, run);
    }

    var flagSpecs = FlagCatalog.Build(run.DataSetId);
    var expectedFinalFlags = ExpectedFinalFlagState.Build(flagSpecs);
    var expectedFinalFlagByKey = expectedFinalFlags.ToDictionary(x => x.Key, StringComparer.OrdinalIgnoreCase);
    run.Flags.AddRange(flagSpecs.Select(x => new FlagRecord(x.Key, x.VariationType)));
    run.ExpectedFinalFlags.AddRange(expectedFinalFlags);
    report.Pass(
        "1.0 Planned feature flags",
        string.Join(Environment.NewLine, flagSpecs.Select(x => $"{x.Key} => {x.VariationType}")));

    foreach (var spec in flagSpecs)
    {
        var created = await api.SendAsync(
            HttpMethod.Post,
            $"/api/v1/envs/{run.EnvId}/feature-flags",
            spec.ToCreatePayload(),
            $"1 Create feature flag {spec.Key}",
            "Create a feature flag with deterministic key, type, variations, and default serving behavior.");

        var read = await api.SendAsync(
            HttpMethod.Get,
            $"/api/v1/envs/{run.EnvId}/feature-flags/{spec.Key}",
            null,
            $"1 Verify feature flag {spec.Key}",
            "Read the feature flag back and verify key/type/variation count.");

        report.Assert(
            NodeString(read, "key") == spec.Key &&
            NodeString(read, "variationType") == spec.VariationType &&
            read?["variations"]?.AsArray().Count >= 2,
            $"1 Verify created flag contract {spec.Key}",
            $"type={NodeString(read, "variationType")}, variations={read?["variations"]?.AsArray().Count ?? 0}");
    }

    var segment = await api.SendAsync(
        HttpMethod.Post,
        $"/api/v1/envs/{run.EnvId}/segments",
        new
        {
            name = $"E2E Segment {run.Suffix}",
            key = run.SegmentKey,
            type = "environment-specific",
            scopes = new[] { run.SegmentScope },
            description = "Users included by the E2E runner for non-experiment flag rule verification"
        },
        "2.1 Create segment",
        "Create a real segment that will be referenced by non-experiment feature flag rules.");
    run.SegmentId = RequiredString(segment, "id");

    var expectedIncludedUsers = new[] { StableUserKey(0), StableUserKey(1), StableUserKey(3) };
    await api.SendAsync(
        HttpMethod.Put,
        $"/api/v1/envs/{run.EnvId}/segments/{run.SegmentId}/targeting",
        new
        {
            included = expectedIncludedUsers,
            excluded = Array.Empty<string>(),
            rules = Array.Empty<object>(),
            comment = "E2E include stable users for segment-rule verification"
        },
        "2.2 Update segment targeting",
        "Add deterministic users to the real segment.");

    var segmentRead = await api.SendAsync(
        HttpMethod.Get,
        $"/api/v1/envs/{run.EnvId}/segments/{run.SegmentId}",
        null,
        "2.3 Verify segment targeting",
        "Read the segment back and verify included users.");
    report.Assert(
        HasAllStrings(segmentRead?["included"]?.AsArray(), expectedIncludedUsers) &&
        (segmentRead?["excluded"]?.AsArray().Count ?? 0) == 0 &&
        (segmentRead?["rules"]?.AsArray().Count ?? 0) == 0 &&
        HasAllStrings(segmentRead?["scopes"]?.AsArray(), [run.SegmentScope]),
        "2.3 Segment targeting verified",
        $"segmentId={run.SegmentId}, segmentKey={run.SegmentKey}, scope={run.SegmentScope}, included={string.Join(", ", expectedIncludedUsers)}");

    var segmentList = await api.SendAsync(
        HttpMethod.Get,
        $"/api/v1/envs/{run.EnvId}/segments?name=&isArchived=false&pageIndex=0&pageSize=100",
        null,
        "2.4 Verify segment list visibility",
        "Verify the generated segment is visible through the same list endpoint used by the UI segments page.");
    var segmentListed = FindObjectByProperty(segmentList?["items"], "key", run.SegmentKey) != null;
    report.Assert(
        segmentListed,
        "2.4 Segment list visibility verified",
        $"segmentKey={run.SegmentKey}, scope={run.SegmentScope}, totalCount={NodeString(segmentList, "totalCount")}");

    for (var index = 0; index < flagSpecs.Length; index++)
    {
        var spec = flagSpecs[index];
        var expectedDescription = $"E2E mutated description for {spec.Key}";
        var expectedTags = new[] { "e2e", "release-decision", spec.VariationType };

        await api.SendAsync(
            HttpMethod.Put,
            $"/api/v1/envs/{run.EnvId}/feature-flags/{spec.Key}/description",
            new
            {
                description = expectedDescription,
                comment = "E2E description mutation"
            },
            $"2 Mutate description {spec.Key}",
            "Update description and verify by reading the flag.");

        await api.SendAsync(
            HttpMethod.Put,
            $"/api/v1/envs/{run.EnvId}/feature-flags/{spec.Key}/tags",
            new
            {
                tags = expectedTags,
                comment = "E2E tag mutation"
            },
            $"2 Mutate tags {spec.Key}",
            "Set feature flag tags.");

        var toggledStatus = index % 2 == 0;
        await api.SendAsync(
            HttpMethod.Put,
            $"/api/v1/envs/{run.EnvId}/feature-flags/{spec.Key}/toggle/{toggledStatus.ToString().ToLowerInvariant()}",
            new { comment = "E2E toggle mutation" },
            $"2 Toggle {spec.Key}",
            "Toggle enabled/disabled status.");

        var afterToggle = await api.SendAsync(
            HttpMethod.Get,
            $"/api/v1/envs/{run.EnvId}/feature-flags/{spec.Key}",
            null,
            $"3 Verify toggle/tags {spec.Key}",
            "Verify toggle status and tags.");
        report.Assert(
            NodeBool(afterToggle, "isEnabled") == toggledStatus &&
            NodeString(afterToggle, "description") == expectedDescription &&
            HasAllStrings(afterToggle?["tags"]?.AsArray(), expectedTags),
            $"3 Description, toggle, and tags verified {spec.Key}",
            $"isEnabled={NodeBool(afterToggle, "isEnabled")}, description={NodeString(afterToggle, "description")}");

        var currentFlag = afterToggle!;
        var currentVariations = currentFlag["variations"]!.AsArray()
            .Select(x => x!.DeepClone())
            .Cast<JsonNode?>()
            .ToList();
        var originalVariationSnapshot = VariationSnapshot(currentVariations);
        var updatedVariations = spec.BuildUpdatedVariations(preserveControlTreatmentNames: index == 0, currentVariations);
        var updatedVariationSnapshot = VariationSnapshot(updatedVariations);
        var variationRevision = NodeString(currentFlag, "revision");
        await api.SendAsync(
            HttpMethod.Put,
            $"/api/v1/envs/{run.EnvId}/feature-flags/{spec.Key}/variations",
            new
            {
                revision = variationRevision,
                variations = updatedVariations,
                comment = "E2E variation mutation"
            },
            $"2 Mutate variations {spec.Key}",
            "Update variation names/values while preserving serving references.");

        var afterVariation = await api.SendAsync(
            HttpMethod.Get,
            $"/api/v1/envs/{run.EnvId}/feature-flags/{spec.Key}",
            null,
            $"3 Verify variations {spec.Key}",
            "Verify variation mutation persisted.");

        report.Assert(
            afterVariation?["variations"]?.AsArray().Count == updatedVariations.Count &&
            VariationSnapshot(afterVariation?["variations"]?.AsArray() ?? []) == updatedVariationSnapshot,
            $"3 Variations verified {spec.Key}",
            $"variationCount={afterVariation?["variations"]?.AsArray().Count}");

        if (index == 0)
        {
            report.Assert(
                originalVariationSnapshot == updatedVariationSnapshot &&
                HasVariation(afterVariation, "control", "false") &&
                HasVariation(afterVariation, "treatment", "true"),
                $"3 Experiment variations intentionally preserved {spec.Key}",
                "The experiment flag keeps control/treatment names and values for release-decision binding.");
        }
        else
        {
            report.Assert(
                originalVariationSnapshot != updatedVariationSnapshot,
                $"3 Meaningful variation mutation verified {spec.Key}",
                "Non-experiment flag variation names or candidates changed.");
        }

        var isExperimentFlag = index == 0;
        var targeting = BuildTargetingPayload(afterVariation!, spec, isExperimentFlag, run.SegmentId);
        await api.SendAsync(
            HttpMethod.Put,
            $"/api/v1/envs/{run.EnvId}/feature-flags/{spec.Key}/targeting",
            targeting,
            $"2 Mutate targeting {spec.Key}",
            isExperimentFlag
                ? "Configure the experiment flag with no targeting rules and 50/50 fallthrough rollout."
                : "Add a real segment-based targeting rule for the flag.");

        var afterTargeting = await api.SendAsync(
            HttpMethod.Get,
            $"/api/v1/envs/{run.EnvId}/feature-flags/{spec.Key}",
            null,
            $"3 Verify targeting {spec.Key}",
            "Verify targeting rules and fallthrough traffic.");
        var ruleCount = afterTargeting?["rules"]?.AsArray().Count ?? 0;
        report.Assert(
            isExperimentFlag ? ruleCount == 0 : ruleCount >= 1,
            $"3 Targeting rules verified {spec.Key}",
            $"ruleCount={ruleCount}");

        if (index == 0)
        {
            run.ControlVariationId = FindVariationId(afterTargeting, "control", "false");
            run.TreatmentVariationId = FindVariationId(afterTargeting, "treatment", "true");
            report.Assert(
                !string.IsNullOrWhiteSpace(run.ControlVariationId) &&
                !string.IsNullOrWhiteSpace(run.TreatmentVariationId),
                "3 Experiment flag variants identified",
                $"control={run.ControlVariationId}, treatment={run.TreatmentVariationId}");
        }
    }

    var references = await api.SendAsync(
        HttpMethod.Get,
        $"/api/v1/envs/{run.EnvId}/segments/{run.SegmentId}/flag-references",
        null,
        "3 Verify segment flag references",
        "Read feature flags that reference the generated real segment.");
    var referencedKeys = references?.AsArray()
        .Select(x => NodeString(x, "key"))
        .Where(x => !string.IsNullOrWhiteSpace(x))
        .ToHashSet(StringComparer.OrdinalIgnoreCase) ?? [];
    var expectedSegmentRuleFlagKeys = flagSpecs.Skip(1).Select(x => x.Key).ToArray();
    report.Assert(
        expectedSegmentRuleFlagKeys.All(referencedKeys.Contains) &&
        !referencedKeys.Contains(flagSpecs[0].Key),
        "3 Segment references verified",
        $"segmentId={run.SegmentId}, referenced={string.Join(", ", referencedKeys.OrderBy(x => x, StringComparer.OrdinalIgnoreCase))}");

    var experimentFlag = flagSpecs[0];
    var sdkValidation = await VerifySdkEvaluationAsync(run, flagSpecs, options);
    run.PreExperimentSdkEvaluations = sdkValidation.TotalEvaluations;
    run.PreExperimentNonExperimentRuleHits = sdkValidation.NonExperimentRuleHits;
    report.Assert(
        sdkValidation.TotalEvaluations >= flagSpecs.Length,
        "4.1 SDK evaluated generated flags",
        sdkValidation.ToString());
    report.Assert(
        sdkValidation.NonExperimentRuleHits == flagSpecs.Length - 1,
        "4.2 SDK non-experiment rule targeting verified",
        $"nonExperimentRuleHits={sdkValidation.NonExperimentRuleHits}, expected={flagSpecs.Length - 1}");

    var experiment = await api.SendAsync(
        HttpMethod.Post,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments",
        new
        {
            name = $"E2E Checkout Activation {run.Suffix}",
            description = "Generated by the REST API E2E runner",
            flagKey = experimentFlag.Key,
            featBitProjectKey = run.ProjectKey
        },
        "5.1 Create release-decision experiment",
        "Bind a release-decision experiment to the boolean experiment flag.");
    run.ExperimentId = RequiredString(experiment, "id");

    var hypothesis =
        "We believe routing eligible users to the treatment checkout experience will increase checkout activation for E2E users because the treatment removes one friction step.";
    await api.SendAsync(
        HttpMethod.Put,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments/{run.ExperimentId}",
        new
        {
            goal = "Increase checkout activation in the generated E2E environment",
            intent = "Validate that REST API, SDK evaluation, metric collection, and release-decision analysis agree end to end.",
            hypothesis,
            change = $"Feature flag {experimentFlag.Key} controls control/treatment routing.",
            variants = "",
            envSecret = run.EnvServerSecret,
            flagServerUrl = options.EventUrl,
            constraints = "Synthetic users only; generated project/environment only.",
            entryMode = "expert"
        },
        "5.2 Fill experiment intent/hypothesis",
        "Populate core release-decision decision-state fields.");

    var experimentRead = await api.SendAsync(
        HttpMethod.Get,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments/{run.ExperimentId}",
        null,
        "5.3 Verify experiment decision fields",
        "Read the experiment back and verify release-decision setup fields.");
    report.Assert(
        NodeString(experimentRead, "flagKey") == experimentFlag.Key &&
        NodeString(experimentRead, "intent").Contains("REST API", StringComparison.OrdinalIgnoreCase) &&
        NodeString(experimentRead, "hypothesis").Contains("checkout activation", StringComparison.OrdinalIgnoreCase),
        "5.3 Experiment setup verified",
        $"experimentId={run.ExperimentId}, flagKey={NodeString(experimentRead, "flagKey")}");

    var guardrailsJson = JsonSerializer.Serialize(new object[]
    {
        new
        {
            eventName = run.ErrorMetric,
            @event = run.ErrorMetric,
            metricType = "binary",
            metricAgg = "once",
            direction = "increase_bad",
            description = "Checkout error rate should not increase."
        },
        new
        {
            eventName = run.LatencyMetric,
            @event = run.LatencyMetric,
            metricType = "continuous",
            metricAgg = "average",
            direction = "increase_bad",
            description = "Checkout latency should not increase."
        }
    });

    var metrics = await api.SendAsync(
        HttpMethod.Put,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments/{run.ExperimentId}/metrics",
        new
        {
            metricName = "Checkout Activation",
            metricEvent = run.PrimaryMetric,
            metricType = "binary",
            metricAgg = "once",
            expectedDirection = "increase_good",
            metricDescription = "Binary activation event after checkout exposure.",
            guardrails = guardrailsJson
        },
        "6 Configure primary and guardrail metrics",
        "Configure one binary primary metric and two guardrails with binary and continuous types.");
    report.Assert(!string.IsNullOrWhiteSpace(NodeString(metrics, "primaryMetric")), "6 Metrics persisted", "primaryMetric JSON exists.");

    var withRun = await api.SendAsync(
        HttpMethod.Post,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments/{run.ExperimentId}/runs",
        new { },
        "7.1 Create experiment run",
        "Create a run that will collect and analyze the SDK-seeded evidence.");
    run.RunId = RequiredString(withRun?["experimentRuns"]?.AsArray().FirstOrDefault(), "id");
    report.Assert(!string.IsNullOrWhiteSpace(run.RunId), "7.1 Run created", $"runId={run.RunId}");

    var observationStart = DateTime.UtcNow.AddHours(-1);
    var observationEnd = DateTime.UtcNow.AddDays(7);
    await api.SendAsync(
        HttpMethod.Put,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments/{run.ExperimentId}/runs/{run.RunId}/audience",
        new
        {
            method = "bayesian_ab",
            controlVariant = run.ControlVariationId,
            treatmentVariant = run.TreatmentVariationId,
            assignmentUnitSelector = "user.keyId",
            layerKey = $"e2e-layer-{run.Suffix}",
            layerTrafficPercent = 100,
            analysisSamplingPlan = JsonSerializer.Serialize(new[]
            {
                new
                {
                    variation = run.ControlVariationId,
                    role = "control",
                    includeRate = 100
                },
                new
                {
                    variation = run.TreatmentVariationId,
                    role = "treatment",
                    includeRate = 100
                }
            }),
            audienceFilters = "synthetic E2E users",
        },
        "7.2 Configure experiment traffic assignment",
        "Bind actual served control/treatment variations and use all served traffic for the run.");

    await api.SendAsync(
        HttpMethod.Put,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments/{run.ExperimentId}/runs/{run.RunId}/observation-window",
        new
        {
            observationStart,
            observationEnd
        },
        "7.3 Configure run observation window",
        "Set an observation window that contains the SDK events generated in this run.");

    await api.SendAsync(
        HttpMethod.Put,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments/{run.ExperimentId}/runs/{run.RunId}",
        new
        {
            status = "collecting",
            hypothesis,
            method = "bayesian_ab",
            methodReason = "E2E validates two fixed variants with synthetic evidence.",
            primaryMetricEvent = run.PrimaryMetric,
            primaryMetricType = "binary",
            primaryMetricAgg = "once",
            guardrailEvents = guardrailsJson,
            minimumSample = options.MinUsersPerVariant,
            dataSourceMode = "featbit-api"
        },
        "7.4 Mark run collecting",
        "Put the run into collecting mode before SDK seeding.");

    var sdkSummary = await SeedWithSdkAsync(run, flagSpecs, options, report);
    report.Assert(sdkSummary.TotalEvaluations > 0, "7.5 SDK evaluation generated evidence", sdkSummary.ToString());

    if (options.PostSdkWaitSeconds > 0)
    {
        await Task.Delay(TimeSpan.FromSeconds(options.PostSdkWaitSeconds));
    }

    var startDate = DateOnly.FromDateTime(observationStart).ToString("yyyy-MM-dd");
    var endDate = DateOnly.FromDateTime(observationEnd).ToString("yyyy-MM-dd");
    var stats = await QueryExperimentStatsAsync(
        api,
        run.EnvId,
        experimentFlag.Key,
        run.PrimaryMetric,
        startDate,
        endDate,
        "binary",
        "once",
        "7.6 Query primary metric stats",
        "Verify SDK exposure and primary metric evidence is observable through experiment-stats.");

    var variantRows = stats?["variants"]?.AsArray() ?? [];
    var usersObserved = variantRows.Sum(x => (long?)x?["users"] ?? 0);
    run.PrimaryMetricUsersObserved = usersObserved;
    run.PrimaryMetricVariantRows = variantRows.Count;
    report.Assert(usersObserved > 0, "7.6 Experiment stats observed users", $"users={usersObserved}, variants={variantRows.Count}");
    AssertVariantMinimumUsers(report, variantRows, run, options, "7.6 Primary metric per-variant sample minimum");
    var controlRate = FindConversionRate(variantRows, run.ControlVariationId);
    var treatmentRate = FindConversionRate(variantRows, run.TreatmentVariationId);
    run.ControlPrimaryUsersObserved = FindUsers(variantRows, run.ControlVariationId);
    run.TreatmentPrimaryUsersObserved = FindUsers(variantRows, run.TreatmentVariationId);
    run.ControlPrimaryConversionsObserved = FindConversions(variantRows, run.ControlVariationId);
    run.TreatmentPrimaryConversionsObserved = FindConversions(variantRows, run.TreatmentVariationId);
    run.ControlPrimaryRate = controlRate;
    run.TreatmentPrimaryRate = treatmentRate;
    var expectedControlPrimaryConversions = TargetCount(run.ControlPrimaryUsersObserved, 0.30);
    var expectedTreatmentPrimaryConversions = TargetCount(run.TreatmentPrimaryUsersObserved, 0.45);
    report.Assert(
        run.ControlPrimaryConversionsObserved == expectedControlPrimaryConversions &&
        run.TreatmentPrimaryConversionsObserved == expectedTreatmentPrimaryConversions,
        "7.6 Deterministic primary metric counts verified",
        $"control={run.ControlPrimaryConversionsObserved}/{run.ControlPrimaryUsersObserved}, expected={expectedControlPrimaryConversions}; treatment={run.TreatmentPrimaryConversionsObserved}/{run.TreatmentPrimaryUsersObserved}, expected={expectedTreatmentPrimaryConversions}");
    report.Assert(
        treatmentRate > controlRate,
        "7.6 Seeded primary metric direction verified",
        $"controlRate={controlRate:0.####}, treatmentRate={treatmentRate:0.####}");

    var errorStats = await QueryExperimentStatsAsync(
        api,
        run.EnvId,
        experimentFlag.Key,
        run.ErrorMetric,
        startDate,
        endDate,
        "binary",
        "once",
        "7.7 Query binary guardrail stats",
        "Verify SDK-seeded checkout error guardrail data is observable.");
    AssertStatsObservedUsers(report, errorStats, "7.7 Binary guardrail users observed");
    var errorRows = errorStats?["variants"]?.AsArray() ?? [];
    AssertVariantMinimumUsers(report, errorRows, run, options, "7.7 Binary guardrail per-variant sample minimum");
    run.ErrorMetricUsersObserved = ObservedUsers(errorRows);
    run.ErrorMetricVariantRows = errorRows.Count;
    run.ControlErrorUsersObserved = FindUsers(errorRows, run.ControlVariationId);
    run.TreatmentErrorUsersObserved = FindUsers(errorRows, run.TreatmentVariationId);
    run.ControlErrorConversionsObserved = FindConversions(errorRows, run.ControlVariationId);
    run.TreatmentErrorConversionsObserved = FindConversions(errorRows, run.TreatmentVariationId);
    var controlErrorRate = FindConversionRate(errorRows, run.ControlVariationId);
    var treatmentErrorRate = FindConversionRate(errorRows, run.TreatmentVariationId);
    run.ControlErrorRate = controlErrorRate;
    run.TreatmentErrorRate = treatmentErrorRate;
    var expectedControlErrors = TargetCount(run.ControlErrorUsersObserved, 0.018);
    var expectedTreatmentErrors = TargetCount(run.TreatmentErrorUsersObserved, 0.020);
    report.Assert(
        run.ControlErrorConversionsObserved == expectedControlErrors &&
        run.TreatmentErrorConversionsObserved == expectedTreatmentErrors,
        "7.7 Deterministic binary guardrail counts verified",
        $"control={run.ControlErrorConversionsObserved}/{run.ControlErrorUsersObserved}, expected={expectedControlErrors}; treatment={run.TreatmentErrorConversionsObserved}/{run.TreatmentErrorUsersObserved}, expected={expectedTreatmentErrors}");
    report.Assert(
        controlErrorRate < 0.05 && treatmentErrorRate < 0.05,
        "7.7 Binary guardrail rates within threshold",
        $"controlErrorRate={controlErrorRate:0.####}, treatmentErrorRate={treatmentErrorRate:0.####}, threshold=0.05");

    var latencyStats = await QueryExperimentStatsAsync(
        api,
        run.EnvId,
        experimentFlag.Key,
        run.LatencyMetric,
        startDate,
        endDate,
        "continuous",
        "average",
        "7.8 Query continuous guardrail stats",
        "Verify SDK-seeded checkout latency guardrail data is observable.");
    AssertStatsObservedUsers(report, latencyStats, "7.8 Continuous guardrail users observed");
    var latencyRows = latencyStats?["variants"]?.AsArray() ?? [];
    AssertVariantMinimumUsers(report, latencyRows, run, options, "7.8 Continuous guardrail per-variant sample minimum");
    run.LatencyMetricUsersObserved = ObservedUsers(latencyRows);
    run.LatencyMetricVariantRows = latencyRows.Count;
    run.ControlLatencyUsersObserved = FindUsers(latencyRows, run.ControlVariationId);
    run.TreatmentLatencyUsersObserved = FindUsers(latencyRows, run.TreatmentVariationId);
    run.ControlLatencySumObserved = FindSumValue(latencyRows, run.ControlVariationId);
    run.TreatmentLatencySumObserved = FindSumValue(latencyRows, run.TreatmentVariationId);
    report.Assert(
        latencyRows.Any(x => ((double?)x?["avgValue"] ?? 0) > 0 || ((double?)x?["sumValue"] ?? 0) > 0),
        "7.8 Continuous guardrail values observed",
        $"variants={latencyRows.Count}, metric={run.LatencyMetric}");
    var controlLatency = FindAverageValue(latencyRows, run.ControlVariationId);
    var treatmentLatency = FindAverageValue(latencyRows, run.TreatmentVariationId);
    run.ControlLatencyMs = controlLatency;
    run.TreatmentLatencyMs = treatmentLatency;
    report.Assert(
        Math.Abs(controlLatency - 340.0) < 0.0001 &&
        Math.Abs(treatmentLatency - 320.0) < 0.0001,
        "7.8 Deterministic continuous guardrail values verified",
        $"controlLatency={controlLatency:0.####}, treatmentLatency={treatmentLatency:0.####}");
    report.Assert(
        treatmentLatency <= controlLatency,
        "7.8 Continuous guardrail direction verified",
        $"controlLatency={controlLatency:0.####}, treatmentLatency={treatmentLatency:0.####}");

    var analyzed = await api.SendAsync(
        HttpMethod.Post,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments/{run.ExperimentId}/runs/{run.RunId}/analyze",
        new { forceFresh = true },
        "8 Analyze experiment run",
        "Run release-decision analysis against the seeded FeatBit stats.");

    var analyzedRun = analyzed?["experimentRuns"]?.AsArray()
        .FirstOrDefault(x => string.Equals(NodeString(x, "id"), run.RunId, StringComparison.OrdinalIgnoreCase));
    run.AnalysisStatus = NodeString(analyzedRun, "status");
    run.AnalysisInputDataHasExpectedMetrics = InputDataContainsMetrics(
        NodeString(analyzedRun, "inputData"),
        run.PrimaryMetric,
        run.ErrorMetric,
        run.LatencyMetric);
    run.AnalysisResultGenerated = !string.IsNullOrWhiteSpace(NodeString(analyzedRun, "analysisResult"));
    report.Assert(
        !string.IsNullOrWhiteSpace(NodeString(analyzedRun, "inputData")) &&
        run.AnalysisResultGenerated,
        "8 Analysis generated inputData and analysisResult",
        $"status={run.AnalysisStatus}");
    report.Assert(
        run.AnalysisStatus == "analyzing",
        "8 Analysis status verified",
        $"status={run.AnalysisStatus}");
    report.Assert(
        run.AnalysisInputDataHasExpectedMetrics,
        "8 Analysis inputData contains configured metrics",
        $"metrics={run.PrimaryMetric}, {run.ErrorMetric}, {run.LatencyMetric}");

    foreach (var scenario in TrafficScenarioSpec.DefaultScenarios(options))
    {
        await RunTrafficScenarioAsync(api, run, experimentFlag, scenario, options, report);
    }

    await UpdateExperimentFlagTrafficAsync(api, run, experimentFlag, controlTrafficShare: 0.5, "11.0");

    var final = await api.SendAsync(
        HttpMethod.Get,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments/{run.ExperimentId}",
        null,
        "11 Final experiment verification",
        "Read the experiment detail and verify the analyzed run remains attached.");

    var finalRun = final?["experimentRuns"]?.AsArray()
        .FirstOrDefault(x => string.Equals(NodeString(x, "id"), run.RunId, StringComparison.OrdinalIgnoreCase));
    report.Assert(
        NodeString(final, "flagKey") == experimentFlag.Key &&
        !string.IsNullOrWhiteSpace(NodeString(finalRun, "analysisResult")),
        "11 Final verification passed",
        $"experimentId={run.ExperimentId}, runId={run.RunId}, flagKey={experimentFlag.Key}, treatmentRate>{controlRate:0.####}");

    foreach (var flag in flagSpecs)
    {
        var finalFlag = await api.SendAsync(
            HttpMethod.Get,
            $"/api/v1/envs/{run.EnvId}/feature-flags/{flag.Key}",
            null,
            $"11 Final flag exists {flag.Key}",
            "Confirm every generated feature flag still exists after release-decision analysis.");
        report.Assert(
            NodeString(finalFlag, "key") == flag.Key &&
            NodeString(finalFlag, "variationType") == flag.VariationType,
            $"11 Final flag contract verified {flag.Key}",
            $"type={NodeString(finalFlag, "variationType")}");
        var expectedFinalFlag = expectedFinalFlagByKey[flag.Key];
        report.Assert(
            NodeBool(finalFlag, "isEnabled") == expectedFinalFlag.FinalEnabled,
            $"11 Final flag enabled state verified {flag.Key}",
            $"expected={expectedFinalFlag.FinalEnabled}, actual={NodeBool(finalFlag, "isEnabled")}");
        report.Assert(
            VariationPairsSnapshot(finalFlag?["variations"]?.AsArray() ?? []) == expectedFinalFlag.FinalVariations,
            $"11 Final flag variants verified {flag.Key}",
            $"expected={expectedFinalFlag.FinalVariations}");

        var isExperimentFlag = string.Equals(flag.Key, experimentFlag.Key, StringComparison.OrdinalIgnoreCase);
        var finalRules = finalFlag?["rules"]?.AsArray() ?? [];
        var finalCondition = finalRules
            .FirstOrDefault()?["conditions"]?.AsArray()
            .FirstOrDefault();
        report.Assert(
            isExperimentFlag
                ? finalRules.Count == 0
                : NodeString(finalCondition, "property") == expectedFinalFlag.RuleProperty &&
                  NodeString(finalCondition, "value").Contains(
                      expectedFinalFlag.RuleValueTemplate.Replace("{segmentId}", run.SegmentId, StringComparison.Ordinal),
                      StringComparison.Ordinal),
            $"11 Final flag rule verified {flag.Key}",
            isExperimentFlag
                ? $"ruleCount={finalRules.Count}"
                : $"property={NodeString(finalCondition, "property")}, value={NodeString(finalCondition, "value")}");

        var finalRule = finalRules.FirstOrDefault();
        var finalRuleVariation = finalRule?["variations"]?.AsArray().FirstOrDefault();
        var expectedRuleVariationId = NodeString(finalFlag?["variations"]?.AsArray().FirstOrDefault(), "id");
        var finalRuleTrafficMatches =
            isExperimentFlag
                ? finalRules.Count == 0
                : NodeBool(finalRule, "includedInExpt") &&
                  NodeString(finalRuleVariation, "id") == expectedRuleVariationId &&
                  RolloutMatches(finalRuleVariation, 0, 1, 1);
        report.Assert(
            finalRuleTrafficMatches,
            $"11 Final flag rule traffic verified {flag.Key}",
            isExperimentFlag
                ? "expected=no targeting rules"
                : $"ruleVariation={NodeString(finalRuleVariation, "id")}, expected={expectedRuleVariationId}");

        var finalFallthroughTrafficMatches =
            NodeBool(finalFlag?["fallthrough"], "includedInExpt") &&
            NodeBool(finalFlag, "exptIncludeAllTargets") &&
            FallthroughTrafficMatches(finalFlag, isExperimentFlag, run.ControlVariationId, run.TreatmentVariationId);
        report.Assert(
            finalFallthroughTrafficMatches,
            $"11 Final flag fallthrough traffic verified {flag.Key}",
            isExperimentFlag
                ? "expected=control 50%, treatment 50%"
                : "expected=first variation 100%");

        run.ObservedFinalFlags.Add(new ObservedFinalFlagState(
            flag.Key,
            NodeString(finalFlag, "variationType"),
            NodeBool(finalFlag, "isEnabled"),
            VariationPairsSnapshot(finalFlag?["variations"]?.AsArray() ?? []),
            NodeString(finalCondition, "property"),
            NodeString(finalCondition, "value"),
            finalRuleTrafficMatches ? expectedFinalFlag.RuleTraffic : $"unexpected rule variation {NodeString(finalRuleVariation, "id")}",
            finalFallthroughTrafficMatches ? expectedFinalFlag.FallthroughTraffic : "unexpected fallthrough traffic",
            NodeBool(finalRule, "includedInExpt"),
            NodeBool(finalFlag?["fallthrough"], "includedInExpt"),
            NodeBool(finalFlag, "exptIncludeAllTargets"),
            expectedFinalFlag.Experimentation));
    }
}

static async Task CreateProjectAndEnvironmentAsync(FeatBitApiClient api, TestReport report, E2ERun run)
{
    var project = await api.SendAsync(
        HttpMethod.Post,
        "/api/v1/projects",
        new
        {
            name = $"E2E API Project {run.Suffix}",
            key = run.ProjectKey
        },
        "0.1 Create project",
        "Create a dedicated project for the REST API and SDK test.");

    run.ProjectId = RequiredString(project, "id");
    run.CreatedProject = true;
    report.Assert(!string.IsNullOrWhiteSpace(run.ProjectId), "0.1 Verify project id", $"projectId={run.ProjectId}");

    var env = await api.SendAsync(
        HttpMethod.Post,
        $"/api/v1/projects/{run.ProjectId}/envs",
        new
        {
            name = $"E2E Environment {run.Suffix}",
            key = run.EnvKey,
            description = "Created by featbit-rest-api-e2e.cs"
        },
        "0.2 Create environment",
        "Create an isolated environment and capture the generated Server Key.");

    run.EnvId = RequiredString(env, "id");
    run.EnvServerSecret = FindSecret(env, "Server");
    report.ProtectSecret(run.EnvServerSecret);
    report.Assert(!string.IsNullOrWhiteSpace(run.EnvId), "0.2 Verify env id", $"envId={run.EnvId}, envKey={run.EnvKey}");
    report.Assert(
        !string.IsNullOrWhiteSpace(run.EnvServerSecret),
        "0.2 Verify server secret",
        string.IsNullOrWhiteSpace(run.EnvServerSecret)
            ? $"Server SDK secret was not found. Returned secrets: {DescribeSecrets(env)}"
            : "Server SDK secret exists and is masked in reports.");

    var projectRead = await api.SendAsync(
        HttpMethod.Get,
        $"/api/v1/projects/{run.ProjectId}",
        null,
        "0.3 Verify project/env lookup",
        "Read the project back and verify the generated env is present.");
    var envFound = projectRead?["environments"]?.AsArray()
        .Any(x => string.Equals(NodeString(x, "id"), run.EnvId, StringComparison.OrdinalIgnoreCase)) == true;
    report.Assert(envFound, "0.3 Verify env is attached to project", $"projectId={run.ProjectId}, envId={run.EnvId}");
}

static async Task UseExistingProjectAndEnvironmentAsync(FeatBitApiClient api, TestReport report, E2ERun run)
{
    var projects = await api.SendAsync(
        HttpMethod.Get,
        "/api/v1/projects",
        null,
        "0.1 Locate existing project",
        "Find the user-created project by key.");

    var project = FindObjectByProperty(projects, "key", run.ProjectKey)
        ?? throw new InvalidOperationException($"Project with key '{run.ProjectKey}' was not found.");

    run.ProjectId = RequiredString(project, "id");
    report.Assert(!string.IsNullOrWhiteSpace(run.ProjectId), "0.1 Verify existing project id", $"projectKey={run.ProjectKey}, projectId={run.ProjectId}");

    var projectRead = await api.SendAsync(
        HttpMethod.Get,
        $"/api/v1/projects/{run.ProjectId}",
        null,
        "0.2 Read existing project",
        "Read project details and locate the user-created environment.");

    var env = FindObjectByProperty(projectRead?["environments"], "id", run.EnvId) ??
              FindObjectByProperty(projectRead, "id", run.EnvId) ??
              throw new InvalidOperationException($"Environment with id '{run.EnvId}' was not found under project '{run.ProjectKey}'.");

    run.EnvKey = NodeString(env, "key");
    run.EnvServerSecret = FindSecret(env, "Server");
    report.ProtectSecret(run.EnvServerSecret);
    report.Assert(!string.IsNullOrWhiteSpace(run.EnvId), "0.2 Verify existing env id", $"envId={run.EnvId}, envKey={run.EnvKey}");
    report.Assert(
        !string.IsNullOrWhiteSpace(run.EnvServerSecret),
        "0.2 Verify existing env server secret",
        string.IsNullOrWhiteSpace(run.EnvServerSecret)
            ? $"Server SDK secret was not found. Returned secrets: {DescribeSecrets(env)}"
            : "Server SDK secret exists and is masked in reports.");

    report.Pass(
        "0.3 Existing project/env selected",
        $"Using projectKey={run.ProjectKey}, projectId={run.ProjectId}, envId={run.EnvId}, envKey={run.EnvKey}. The runner will not delete this project.");
}

static Task<JsonNode?> QueryExperimentStatsAsync(
    FeatBitApiClient api,
    string envId,
    string flagKey,
    string metricEvent,
    string startDate,
    string endDate,
    string metricType,
    string metricAgg,
    string name,
    string meaning)
{
    return api.SendAsync(
        HttpMethod.Post,
        $"/api/v1/envs/{envId}/experiment-stats/query",
        new
        {
            flagKey,
            metricEvent,
            startDate,
            endDate,
            metricType,
            metricAgg
        },
        name,
        meaning);
}

static Task<JsonNode?> QueryExperimentStatsWithRunAsync(
    FeatBitApiClient api,
    string envId,
    string flagKey,
    string metricEvent,
    DateTime startTime,
    DateTime endTime,
    string metricType,
    string metricAgg,
    object extra,
    string name,
    string meaning)
{
    var payload = JsonSerializer.SerializeToNode(new
    {
        flagKey,
        metricEvent,
        startDate = DateOnly.FromDateTime(startTime).ToString("yyyy-MM-dd"),
        endDate = DateOnly.FromDateTime(endTime).ToString("yyyy-MM-dd"),
        startTime,
        endTime,
        metricType,
        metricAgg
    })!.AsObject();

    foreach (var property in JsonSerializer.SerializeToNode(extra)!.AsObject())
    {
        payload[property.Key] = property.Value?.DeepClone();
    }

    return api.SendAsync(
        HttpMethod.Post,
        $"/api/v1/envs/{envId}/experiment-stats/query",
        payload,
        name,
        meaning);
}

static async Task RunTrafficScenarioAsync(
    FeatBitApiClient api,
    E2ERun run,
    FlagSpec experimentFlag,
    TrafficScenarioSpec scenario,
    E2EOptions options,
    TestReport report)
{
    await UpdateExperimentFlagTrafficAsync(api, run, experimentFlag, scenario.ControlTrafficShare, $"10.{scenario.Order}.1");
    await Task.Delay(TimeSpan.FromSeconds(Math.Max(1, options.PostSdkWaitSeconds)));

    var metricEvent = $"e2e_{scenario.Id.Replace('-', '_')}_activated_{run.MetricSuffix}";
    var experiment = await api.SendAsync(
        HttpMethod.Post,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments",
        new
        {
            name = $"E2E {scenario.Name} {run.Suffix}",
            description = $"Generated traffic-assignment scenario {scenario.Id}",
            flagKey = experimentFlag.Key,
            featBitProjectKey = run.ProjectKey
        },
        $"10.{scenario.Order}.2 Create scenario experiment {scenario.Id}",
        "Create an independent release-decision experiment for this traffic-assignment scenario.");
    var experimentId = RequiredString(experiment, "id");

    var hypothesis = $"Scenario {scenario.Name}: validate run analysis uses actual served variations with configured sampling.";
    await api.SendAsync(
        HttpMethod.Put,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments/{experimentId}",
        new
        {
            goal = "Validate release-decision traffic assignment semantics",
            intent = scenario.Name,
            hypothesis,
            change = $"Feature flag {experimentFlag.Key} is set to {scenario.ControlTrafficShare:P0}/{1 - scenario.ControlTrafficShare:P0} for this scenario.",
            envSecret = run.EnvServerSecret,
            flagServerUrl = options.EventUrl,
            constraints = "Synthetic users only; scenario-specific metric event and observation window.",
            entryMode = "expert"
        },
        $"10.{scenario.Order}.3 Update scenario experiment {scenario.Id}",
        "Persist scenario-specific release-decision state.");

    var metrics = await api.SendAsync(
        HttpMethod.Put,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments/{experimentId}/metrics",
        new
        {
            metricName = $"{scenario.Name} activation",
            metricEvent,
            metricType = "binary",
            metricAgg = "once",
            expectedDirection = "increase_good",
            metricDescription = scenario.Description,
            guardrails = "[]"
        },
        $"10.{scenario.Order}.4 Configure scenario metric {scenario.Id}",
        "Use a scenario-specific primary metric so evidence does not overlap with other experiments.");
    report.Assert(!string.IsNullOrWhiteSpace(NodeString(metrics, "primaryMetric")),
        $"10.{scenario.Order}.4 Scenario metric persisted {scenario.Id}",
        $"metricEvent={metricEvent}");

    var withRun = await api.SendAsync(
        HttpMethod.Post,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments/{experimentId}/runs",
        new { },
        $"10.{scenario.Order}.5 Create scenario run {scenario.Id}",
        "Create an independent run for this traffic-assignment scenario.");
    var runId = RequiredString(withRun?["experimentRuns"]?.AsArray().FirstOrDefault(), "id");

    var samplingPlan = JsonSerializer.Serialize(new[]
    {
        new
        {
            variation = run.ControlVariationId,
            role = "control",
            includeRate = scenario.ControlIncludeRate
        },
        new
        {
            variation = run.TreatmentVariationId,
            role = "treatment",
            includeRate = scenario.TreatmentIncludeRate
        }
    });

    var observationStart = DateTime.UtcNow.AddSeconds(-1);
    await api.SendAsync(
        HttpMethod.Put,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments/{experimentId}/runs/{runId}/audience",
        new
        {
            method = "bayesian_ab",
            controlVariant = run.ControlVariationId,
            treatmentVariant = run.TreatmentVariationId,
            assignmentUnitSelector = "user.keyId",
            layerKey = $"e2e-{scenario.Id}-{run.Suffix}",
            layerTrafficPercent = scenario.LayerTrafficPercent,
            analysisSamplingPlan = samplingPlan,
            audienceFilters = $"synthetic E2E users for {scenario.Id}"
        },
        $"10.{scenario.Order}.6 Configure scenario traffic {scenario.Id}",
        "Configure actual-variation roles, optional layer eligibility, and per-variation sampling.");

    var seed = await SeedTrafficScenarioWithSdkAsync(run, experimentFlag, options, scenario, metricEvent);
    var observationEnd = DateTime.UtcNow.AddSeconds(10);

    await api.SendAsync(
        HttpMethod.Put,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments/{experimentId}/runs/{runId}/observation-window",
        new
        {
            observationStart,
            observationEnd
        },
        $"10.{scenario.Order}.7 Configure scenario window {scenario.Id}",
        "Use a scenario-specific observation window around the SDK evidence.");

    await api.SendAsync(
        HttpMethod.Put,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments/{experimentId}/runs/{runId}",
        new
        {
            status = "collecting",
            hypothesis,
            method = "bayesian_ab",
            methodReason = scenario.Description,
            primaryMetricEvent = metricEvent,
            primaryMetricType = "binary",
            primaryMetricAgg = "once",
            guardrailEvents = "[]",
            minimumSample = options.MinUsersPerVariant,
            dataSourceMode = "featbit-api"
        },
        $"10.{scenario.Order}.8 Mark scenario collecting {scenario.Id}",
        "Move the scenario run into collecting mode before analysis.");

    var stats = await QueryExperimentStatsWithRunAsync(
        api,
        run.EnvId,
        experimentFlag.Key,
        metricEvent,
        observationStart,
        observationEnd,
        "binary",
        "once",
        new
        {
            runId,
            assignmentUnitSelector = "user.keyId",
            layerKey = $"e2e-{scenario.Id}-{run.Suffix}",
            layerTrafficPercent = scenario.LayerTrafficPercent,
            analysisSamplingPlan = samplingPlan
        },
        $"10.{scenario.Order}.9 Query scenario stats {scenario.Id}",
        "Verify scenario stats use run traffic assignment instead of raw flag split.");

    var rows = stats?["variants"]?.AsArray() ?? [];
    var controlUsers = FindUsers(rows, run.ControlVariationId);
    var treatmentUsers = FindUsers(rows, run.TreatmentVariationId);
    var controlConversions = FindConversions(rows, run.ControlVariationId);
    var treatmentConversions = FindConversions(rows, run.TreatmentVariationId);
    var expectedControlConversions = TargetCount(controlUsers, scenario.ControlConversionRate);
    var expectedTreatmentConversions = TargetCount(treatmentUsers, scenario.TreatmentConversionRate);

    report.Assert(
        controlUsers >= scenario.MinExpectedUsersPerVariant &&
        treatmentUsers >= scenario.MinExpectedUsersPerVariant,
        $"10.{scenario.Order}.9 Scenario sample floor {scenario.Id}",
        $"controlUsers={controlUsers}, treatmentUsers={treatmentUsers}, min={scenario.MinExpectedUsersPerVariant}, seed={seed}");
    report.Assert(
        controlConversions == expectedControlConversions &&
        treatmentConversions == expectedTreatmentConversions,
        $"10.{scenario.Order}.9 Scenario deterministic conversions {scenario.Id}",
        $"control={controlConversions}/{controlUsers}, expected={expectedControlConversions}; treatment={treatmentConversions}/{treatmentUsers}, expected={expectedTreatmentConversions}");

    if (scenario.ExpectBalancedAnalysis)
    {
        var ratio = controlUsers == 0 ? double.PositiveInfinity : (double)treatmentUsers / controlUsers;
        report.Assert(
            ratio is >= 0.5 and <= 2.0,
            $"10.{scenario.Order}.9 Scenario balanced evidence ratio {scenario.Id}",
            $"controlUsers={controlUsers}, treatmentUsers={treatmentUsers}, ratio={ratio:0.###}");
    }

    var analyzed = await api.SendAsync(
        HttpMethod.Post,
        $"/api/v1/envs/{run.EnvId}/release-decision/experiments/{experimentId}/runs/{runId}/analyze",
        new { forceFresh = true },
        $"10.{scenario.Order}.10 Analyze scenario {scenario.Id}",
        "Run release-decision analysis for this scenario experiment.");
    var analyzedRun = analyzed?["experimentRuns"]?.AsArray()
        .FirstOrDefault(x => string.Equals(NodeString(x, "id"), runId, StringComparison.OrdinalIgnoreCase));
    report.Assert(
        InputDataContainsMetrics(NodeString(analyzedRun, "inputData"), metricEvent) &&
        !string.IsNullOrWhiteSpace(NodeString(analyzedRun, "analysisResult")),
        $"10.{scenario.Order}.10 Scenario analysis output {scenario.Id}",
        $"experimentId={experimentId}, runId={runId}, metric={metricEvent}");

    run.TrafficScenarioResults.Add(new TrafficScenarioResult(
        scenario.Id,
        scenario.Name,
        experimentId,
        runId,
        metricEvent,
        scenario.ControlTrafficShare,
        scenario.ControlIncludeRate,
        scenario.TreatmentIncludeRate,
        scenario.LayerTrafficPercent,
        controlUsers,
        treatmentUsers,
        controlConversions,
        treatmentConversions));
}

static async Task UpdateExperimentFlagTrafficAsync(
    FeatBitApiClient api,
    E2ERun run,
    FlagSpec experimentFlag,
    double controlTrafficShare,
    string stepPrefix)
{
    var current = await api.SendAsync(
        HttpMethod.Get,
        $"/api/v1/envs/{run.EnvId}/feature-flags/{experimentFlag.Key}",
        null,
        $"{stepPrefix} Read experiment flag",
        "Read current flag revision before updating experiment fallthrough traffic.");

    await api.SendAsync(
        HttpMethod.Put,
        $"/api/v1/envs/{run.EnvId}/feature-flags/{experimentFlag.Key}/targeting",
        BuildTargetingPayload(current!, experimentFlag, isExperimentFlag: true, experimentControlTraffic: controlTrafficShare),
        $"{stepPrefix} Update experiment flag traffic",
        $"Set experiment flag fallthrough traffic to control {controlTrafficShare:P0}, treatment {1 - controlTrafficShare:P0}.");
}

static async Task<TrafficScenarioSeedSummary> SeedTrafficScenarioWithSdkAsync(
    E2ERun run,
    FlagSpec experimentFlag,
    E2EOptions options,
    TrafficScenarioSpec scenario,
    string metricEvent)
{
    var sdkOptions = new FbOptionsBuilder(run.EnvServerSecret)
        .Event(new Uri(options.EventUrl))
        .Streaming(new Uri(options.StreamingUrl))
        .StartWaitTime(TimeSpan.FromSeconds(options.SdkStartWaitSeconds))
        .MaxEventPerRequest(options.BatchSize)
        .Build();

    var client = new FbClient(sdkOptions);
    try
    {
        if (!client.Initialized)
        {
            throw new InvalidOperationException(
                $"FeatBit SDK did not initialize. Status: {client.Status}. Check event-url, streaming-url, and generated env server secret.");
        }

        var assignments = new List<SeededExperimentUser>(options.Users);
        for (var batchStart = 0; batchStart < options.Users; batchStart += options.BatchSize)
        {
            var batchEnd = Math.Min(batchStart + options.BatchSize, options.Users);
            for (var index = batchStart; index < batchEnd; index++)
            {
                var user = BuildSyntheticUser(index, $"e2e-{scenario.Id}");
                var detail = Evaluate(client, experimentFlag, user);
                assignments.Add(new SeededExperimentUser(index, user.Key, user, detail.ValueId, detail.ValueText));
            }

            if (!client.FlushAndWait(TimeSpan.FromSeconds(options.FlushTimeoutSeconds)))
            {
                throw new TimeoutException(
                    $"Timed out after {options.FlushTimeoutSeconds} seconds while flushing SDK exposure events for scenario {scenario.Id} users {batchStart}-{batchEnd - 1}.");
            }
        }

        var primaryUserKeys = SelectMetricUserKeys(
            assignments,
            run.ControlVariationId,
            rate: scenario.ControlConversionRate,
            salt: metricEvent)
            .Concat(SelectMetricUserKeys(assignments, run.TreatmentVariationId, rate: scenario.TreatmentConversionRate, salt: metricEvent))
            .ToHashSet(StringComparer.Ordinal);

        for (var batchStart = 0; batchStart < assignments.Count; batchStart += options.BatchSize)
        {
            var batch = assignments.Skip(batchStart).Take(options.BatchSize).ToArray();
            foreach (var assignment in batch)
            {
                if (primaryUserKeys.Contains(assignment.UserKey))
                {
                    client.Track(assignment.User, metricEvent);
                }
            }

            if (!client.FlushAndWait(TimeSpan.FromSeconds(options.FlushTimeoutSeconds)))
            {
                var batchEnd = Math.Min(batchStart + options.BatchSize, assignments.Count);
                throw new TimeoutException(
                    $"Timed out after {options.FlushTimeoutSeconds} seconds while flushing SDK metric events for scenario {scenario.Id} users {batchStart}-{batchEnd - 1}.");
            }
        }

        return new TrafficScenarioSeedSummary(
            assignments.Count(x => string.Equals(x.VariationId, run.ControlVariationId, StringComparison.OrdinalIgnoreCase)),
            assignments.Count(x => string.Equals(x.VariationId, run.TreatmentVariationId, StringComparison.OrdinalIgnoreCase)));
    }
    finally
    {
        await client.CloseAsync();
    }
}

static async Task<SdkValidationSummary> VerifySdkEvaluationAsync(
    E2ERun run,
    FlagSpec[] flags,
    E2EOptions options)
{
    var sdkOptions = new FbOptionsBuilder(run.EnvServerSecret)
        .Event(new Uri(options.EventUrl))
        .Streaming(new Uri(options.StreamingUrl))
        .StartWaitTime(TimeSpan.FromSeconds(options.SdkStartWaitSeconds))
        .MaxEventPerRequest(options.BatchSize)
        .Build();

    var client = new FbClient(sdkOptions);
    try
    {
        if (!client.Initialized)
        {
            throw new InvalidOperationException(
                $"FeatBit SDK did not initialize. Status: {client.Status}. Check event-url, streaming-url, and generated env server secret.");
        }

        var summary = new SdkValidationSummary();
        var representativeUsers = new[] { BuildSyntheticUser(0), BuildSyntheticUser(1) };
        foreach (var user in representativeUsers)
        {
            foreach (var flag in flags)
            {
                var detail = Evaluate(client, flag, user);
                summary.TotalEvaluations++;
                summary.Count(flag.Key, detail.ValueId, detail.ValueText);
            }
        }

        var enterpriseUser = BuildSyntheticUser(3);
        foreach (var flag in flags.Skip(1))
        {
            var detail = Evaluate(client, flag, enterpriseUser);
            summary.TotalEvaluations++;
            summary.Count(flag.Key, detail.ValueId, detail.ValueText);
            if (string.Equals(detail.ValueId, flag.Variations[0].Id, StringComparison.OrdinalIgnoreCase))
            {
                summary.NonExperimentRuleHits++;
            }
        }

        if (!client.FlushAndWait(TimeSpan.FromSeconds(options.FlushTimeoutSeconds)))
        {
            throw new TimeoutException($"Timed out after {options.FlushTimeoutSeconds} seconds while flushing pre-experiment SDK evaluation events.");
        }

        return summary;
    }
    finally
    {
        await client.CloseAsync();
    }
}

static void AssertStatsObservedUsers(TestReport report, JsonNode? stats, string name)
{
    var variantRows = stats?["variants"]?.AsArray() ?? [];
    var usersObserved = ObservedUsers(variantRows);
    report.Assert(usersObserved > 0, name, $"users={usersObserved}, variants={variantRows.Count}");
}

static void AssertVariantMinimumUsers(TestReport report, JsonArray variantRows, E2ERun run, E2EOptions options, string name)
{
    var controlUsers = FindUsers(variantRows, run.ControlVariationId);
    var treatmentUsers = FindUsers(variantRows, run.TreatmentVariationId);
    report.Assert(
        controlUsers >= options.MinUsersPerVariant && treatmentUsers >= options.MinUsersPerVariant,
        name,
        $"controlUsers={controlUsers}, treatmentUsers={treatmentUsers}, minimum={options.MinUsersPerVariant}");
}

static long ObservedUsers(JsonArray variantRows) =>
    variantRows.Sum(x => (long?)x?["users"] ?? 0);

static async Task RunSelfCheckAsync(string[] args)
{
    var options = new E2EOptions(
        "http://self-check.invalid",
        "http://self-check.invalid",
        "ws://self-check.invalid",
        "self-check-token",
        "",
        "",
        "raw",
        "",
        "playground",
        "",
        "",
        "",
        "",
        1500,
        500,
        100,
        1,
        1,
        0,
        0,
        false);
    var report = new TestReport(options);
    var run = new E2ERun(options)
    {
        ProjectId = "self-check-project",
        EnvId = "self-check-env",
        EnvServerSecret = "self-check-env-secret",
        SegmentId = "11111111-1111-1111-1111-111111111111",
        ExperimentId = "self-check-experiment",
        RunId = "self-check-run"
    };
    report.ProtectSecret(run.EnvServerSecret);

    var flags = FlagCatalog.Build("selfcheck");
    run.Flags.AddRange(flags.Select(x => new FlagRecord(x.Key, x.VariationType)));

    report.Assert(flags.Length == 10, "Self-check flag count", "The runner plans exactly 10 feature flags.");
    report.Assert(
        flags.Select(x => x.Key).Distinct(StringComparer.OrdinalIgnoreCase).Count() == 10,
        "Self-check flag keys unique",
        string.Join(", ", flags.Select(x => $"{x.Key}:{x.VariationType}")));
    report.Assert(
        new[] { "boolean", "string", "number", "json" }.All(type => flags.Any(x => x.VariationType == type)),
        "Self-check flag types",
        "Covers boolean, string, number, and json flags.");
    report.Assert(
        run.ProjectKey == $"e2e-api-{run.Suffix}" &&
        run.EnvKey == $"e2e-env-{run.Suffix}" &&
        run.OrganizationKey == "playground" &&
        run.SegmentScope == $"organization/playground:project/{run.ProjectKey}:env/{run.EnvKey}" &&
        run.SegmentKey == $"e2e-segment-{run.Suffix}",
        "Self-check generated resource keys",
        $"organizationKey={run.OrganizationKey}, projectKey={run.ProjectKey}, envKey={run.EnvKey}, segmentKey={run.SegmentKey}");
    report.Assert(
        run.MetricSuffix == run.Suffix.Replace('-', '_') &&
        run.PrimaryMetric == $"e2e_checkout_activated_{run.MetricSuffix}" &&
        run.ErrorMetric == $"e2e_checkout_error_{run.MetricSuffix}" &&
        run.LatencyMetric == $"e2e_checkout_latency_ms_{run.MetricSuffix}",
        "Self-check generated metric keys",
        $"primary={run.PrimaryMetric}, error={run.ErrorMetric}, latency={run.LatencyMetric}");

    var fakeEnv = new JsonObject
    {
        ["secrets"] = new JsonArray
        {
            new JsonObject
            {
                ["id"] = "server-secret-id",
                ["name"] = "Server Key",
                ["type"] = "server",
                ["value"] = "server-secret-value"
            },
            new JsonObject
            {
                ["id"] = "client-secret-id",
                ["name"] = "Client Key",
                ["type"] = "client",
                ["value"] = "client-secret-value"
            }
        }
    };
    report.Assert(
        FindSecret(fakeEnv, "Server") == "server-secret-value",
        "Self-check server secret parser",
        "The runner can extract the Server SDK secret from the environment response shape.");
    report.ProtectSecret("server-secret-value");
    report.Assert(
        report.Redacts("token=self-check-token secret=server-secret-value", "self-check-token", "server-secret-value"),
        "Self-check report secret masking",
        "Report details redact both access tokens and environment server secrets.");

    var experimentFlag = flags[0];
    var fakeFlag = BuildFakeFlagJson(experimentFlag);
    var currentVariations = fakeFlag["variations"]!.AsArray()
        .Select(x => x!.DeepClone())
        .Cast<JsonNode?>()
        .ToList();
    var updated = experimentFlag.BuildUpdatedVariations(preserveControlTreatmentNames: true, currentVariations);
    report.Assert(
        updated.OfType<JsonObject>().Any(x => NodeString(x, "name") == "control") &&
        updated.OfType<JsonObject>().Any(x => NodeString(x, "name") == "treatment"),
        "Self-check experiment variants preserved",
        "The experiment flag keeps control/treatment names after the variations mutation.");

    var nonExperimentBool = flags[^1];
    var fakeNonExperimentFlag = BuildFakeFlagJson(nonExperimentBool);
    var nonExperimentVariations = fakeNonExperimentFlag["variations"]!.AsArray()
        .Select(x => x!.DeepClone())
        .Cast<JsonNode?>()
        .ToList();
    var beforeNonExperimentVariationSnapshot = VariationSnapshot(nonExperimentVariations);
    var afterNonExperimentVariationSnapshot = VariationSnapshot(
        nonExperimentBool.BuildUpdatedVariations(preserveControlTreatmentNames: false, nonExperimentVariations));
    report.Assert(
        beforeNonExperimentVariationSnapshot != afterNonExperimentVariationSnapshot,
        "Self-check non-experiment variation mutation",
        "Non-experiment flags receive a meaningful variation mutation.");

    var targeting = JsonSerializer.SerializeToNode(BuildTargetingPayload(fakeFlag, experimentFlag, isExperimentFlag: true))!;
    var rules = targeting["targeting"]?["rules"]?.AsArray();
    report.Assert(
        rules is { Count: 0 },
        "Self-check experiment targeting payload",
        "The experiment flag targeting payload has no targeting rules.");
    var experimentTargetingFlag = JsonSerializer.SerializeToNode(targeting["targeting"]!)!;
    experimentTargetingFlag["variations"] = fakeFlag["variations"]!.DeepClone();
    report.Assert(
        FallthroughTrafficMatches(experimentTargetingFlag, isExperimentFlag: true, experimentFlag.Variations[0].Id, experimentFlag.Variations[1].Id),
        "Self-check experiment fallthrough traffic",
        "The experiment flag final traffic is 50% control and 50% treatment.");

    var segmentTargeting = JsonSerializer.SerializeToNode(
        BuildTargetingPayload(fakeNonExperimentFlag, nonExperimentBool, isExperimentFlag: false, run.SegmentId))!;
    var segmentCondition = segmentTargeting["targeting"]?["rules"]?.AsArray().FirstOrDefault()?["conditions"]?.AsArray().FirstOrDefault();
    report.Assert(
        NodeString(segmentCondition, "property") == "User is in segment" &&
        NodeString(segmentCondition, "op") == "IsOneOf" &&
        NodeString(segmentCondition, "value").Contains(run.SegmentId, StringComparison.Ordinal),
        "Self-check real segment targeting payload",
        "Non-experiment flag targeting references the generated real segment id.");

    run.ControlVariationId = experimentFlag.Variations[0].Id;
    run.TreatmentVariationId = experimentFlag.Variations[1].Id;
    var stats = new JsonArray
    {
        new JsonObject
        {
            ["variant"] = run.ControlVariationId,
            ["users"] = options.MinUsersPerVariant,
            ["conversions"] = (int)Math.Round(options.MinUsersPerVariant * 0.30, MidpointRounding.AwayFromZero),
            ["conversionRate"] = 0.30
        },
        new JsonObject
        {
            ["variant"] = run.TreatmentVariationId,
            ["users"] = options.MinUsersPerVariant,
            ["conversions"] = (int)Math.Round(options.MinUsersPerVariant * 0.45, MidpointRounding.AwayFromZero),
            ["conversionRate"] = 0.45
        }
    };
    report.Assert(
        FindConversionRate(stats, run.TreatmentVariationId) > FindConversionRate(stats, run.ControlVariationId),
        "Self-check seeded result direction",
        "Synthetic treatment conversion rate is higher than control.");
    report.Assert(
        InputDataContainsMetrics(
            """
            {
              "metrics": {
                "e2e_checkout_activated_selfcheck": { "control": { "n": 100, "k": 30 } },
                "e2e_checkout_error_selfcheck": { "control": { "n": 100, "k": 2 } },
                "e2e_checkout_latency_ms_selfcheck": { "control": { "n": 100, "sum": 34000, "sum_squares": 11560000 } }
              }
            }
            """,
            "e2e_checkout_activated_selfcheck",
            "e2e_checkout_error_selfcheck",
            "e2e_checkout_latency_ms_selfcheck"),
        "Self-check analysis inputData metric parser",
        "The runner verifies that analyze inputData contains primary and guardrail metrics.");
    var scenarios = TrafficScenarioSpec.DefaultScenarios(options);
    report.Assert(
        scenarios.Length == 4 &&
        scenarios.Select(x => x.Id).Distinct(StringComparer.OrdinalIgnoreCase).Count() == 4,
        "Self-check traffic scenario catalog",
        string.Join(", ", scenarios.Select(x => $"{x.Id}:flagControl={x.ControlTrafficShare:0.######},sample={x.ControlIncludeRate:0.######}/{x.TreatmentIncludeRate:0.######},layer={x.LayerTrafficPercent:0.######}")));
    report.Assert(
        scenarios.Any(x => x.Id == "skewed-90-10-to-10-10" && x.ExpectBalancedAnalysis) &&
        scenarios.Any(x => x.Id == "layer-30-50-50" && Math.Abs(x.LayerTrafficPercent - 30) < 0.000001),
        "Self-check traffic scenario semantics",
        "The runner includes skewed sampled-to-balanced and layer-eligibility scenarios.");

    report.Pass("Self-check completed", "Offline deterministic script checks passed.");
    Console.WriteLine("Self-check completed. No report files were written because this was not a live E2E run.");
    await Task.CompletedTask;
}

static void PrintPlan(string[] args)
{
    var bag = ArgBag.Parse(args);
    var dataSetId = bag.Last("plan-suffix") ?? E2ERun.FixedDataSetId;
    var flags = FlagCatalog.Build(dataSetId);

    var markdown = BuildPlanMarkdown(dataSetId, flags);

    Console.WriteLine(markdown);
    Console.WriteLine("Plan printed only. No report files were written because this was not a live E2E run.");
}

static async Task RunOpenApiPreflightAsync(string[] args)
{
    var bag = ArgBag.Parse(args);
    var apiUrl = NormalizeBaseUrl(bag.Last("api-url") ?? Env("FEATBIT_API_URL", "https://app-api.featbit.co"));
    var swaggerUrl = bag.Last("swagger-url") ?? $"{apiUrl}/swagger/OpenApi/swagger.json";

    using var http = new HttpClient();
    using var response = await http.GetAsync(swaggerUrl);
    var body = await response.Content.ReadAsStringAsync();
    if (!response.IsSuccessStatusCode)
    {
        throw new HttpRequestException(
            $"OpenAPI preflight failed to fetch {swaggerUrl}: HTTP {(int)response.StatusCode} {response.ReasonPhrase}: {body}");
    }

    var root = JsonNode.Parse(body);
    var paths = root?["paths"]?.AsObject()
        ?? throw new InvalidOperationException($"OpenAPI document at {swaggerUrl} does not contain a paths object.");
    var operations = paths
        .SelectMany(path => path.Value?.AsObject().Select(method => new OpenApiOperation(method.Key, path.Key)) ?? [])
        .Select(x => new OpenApiOperation(x.Method.ToUpperInvariant(), NormalizeOpenApiPath(x.Path)))
        .ToHashSet();

    Console.WriteLine($"OpenAPI preflight: {swaggerUrl}");
    Console.WriteLine();

    var required = RequiredSwaggerEndpoints();
    var advisory = AdvisorySwaggerEndpoints();
    var missingRequired = PrintEndpointChecks("Required Swagger endpoints", required, operations);
    _ = PrintEndpointChecks("Advisory endpoints not always published in SaaS Swagger", advisory, operations);

    Console.WriteLine();
    if (missingRequired == 0)
    {
        Console.WriteLine("OpenAPI preflight passed for Swagger-advertised management endpoints.");
        Console.WriteLine("No report files were written because this was not a live E2E run.");
        return;
    }

    Console.WriteLine($"OpenAPI preflight failed: {missingRequired} required endpoint(s) were missing.");
    Environment.ExitCode = 1;
}

static int PrintEndpointChecks(string title, OpenApiOperation[] expected, HashSet<OpenApiOperation> actual)
{
    Console.WriteLine($"## {title}");
    var missing = 0;
    foreach (var endpoint in expected)
    {
        var normalized = endpoint with { Path = NormalizeOpenApiPath(endpoint.Path), Method = endpoint.Method.ToUpperInvariant() };
        var exists = actual.Contains(normalized);
        if (!exists)
        {
            missing++;
        }

        Console.WriteLine($"{(exists ? "PASS" : "MISSING")}: {endpoint.Method.ToUpperInvariant()} {endpoint.Path}");
    }

    Console.WriteLine();
    return missing;
}

static OpenApiOperation[] RequiredSwaggerEndpoints() =>
[
    new("POST", "/api/v1/projects"),
    new("GET", "/api/v1/projects/{id}"),
    new("POST", "/api/v1/projects/{projectId}/envs"),
    new("GET", "/api/v1/envs/{envId}/feature-flags/{key}"),
    new("POST", "/api/v1/envs/{envId}/feature-flags"),
    new("PUT", "/api/v1/envs/{envId}/feature-flags/{key}/toggle/{status}"),
    new("PUT", "/api/v1/envs/{envId}/feature-flags/{key}/description"),
    new("PUT", "/api/v1/envs/{envId}/feature-flags/{key}/variations"),
    new("PUT", "/api/v1/envs/{envId}/feature-flags/{key}/targeting"),
    new("PUT", "/api/v1/envs/{envId}/feature-flags/{key}/tags"),
    new("GET", "/api/v1/envs/{envId}/segments"),
    new("POST", "/api/v1/envs/{envId}/segments"),
    new("GET", "/api/v1/envs/{envId}/segments/{segmentId}"),
    new("PUT", "/api/v1/envs/{envId}/segments/{segmentId}/targeting"),
    new("GET", "/api/v1/envs/{envId}/segments/{segmentId}/flag-references")
];

static OpenApiOperation[] AdvisorySwaggerEndpoints() =>
[
    new("POST", "/api/v1/envs/{envId}/release-decision/experiments"),
    new("GET", "/api/v1/envs/{envId}/release-decision/experiments/{id}"),
    new("PUT", "/api/v1/envs/{envId}/release-decision/experiments/{id}"),
    new("PUT", "/api/v1/envs/{envId}/release-decision/experiments/{id}/metrics"),
    new("POST", "/api/v1/envs/{envId}/release-decision/experiments/{id}/runs"),
    new("PUT", "/api/v1/envs/{envId}/release-decision/experiments/{id}/runs/{runId}"),
    new("PUT", "/api/v1/envs/{envId}/release-decision/experiments/{id}/runs/{runId}/audience"),
    new("PUT", "/api/v1/envs/{envId}/release-decision/experiments/{id}/runs/{runId}/observation-window"),
    new("POST", "/api/v1/envs/{envId}/release-decision/experiments/{id}/runs/{runId}/analyze"),
    new("POST", "/api/v1/envs/{envId}/experiment-stats/query")
];

static string Env(string key, string fallback) =>
    Environment.GetEnvironmentVariable(key) is { Length: > 0 } value ? value : fallback;

static string NormalizeBaseUrl(string value) => new Uri(value).ToString().TrimEnd('/');

static async Task<E2EOptions> ResolveAccessTokenAsync(E2EOptions options)
{
    if (!string.IsNullOrWhiteSpace(options.AccessToken))
    {
        return options;
    }

    if (string.IsNullOrWhiteSpace(options.LoginEmail) || string.IsNullOrWhiteSpace(options.LoginPassword))
    {
        throw new ArgumentException("Access token is required unless --login-email and --login-password are provided.");
    }

    using var http = new HttpClient
    {
        BaseAddress = new Uri(options.ApiUrl)
    };

    var response = await http.PostAsJsonAsync(
        "/api/v1/identity/login-by-email",
        new
        {
            email = options.LoginEmail,
            password = options.LoginPassword
        });
    var body = await response.Content.ReadAsStringAsync();
    if (!response.IsSuccessStatusCode)
    {
        throw new HttpRequestException($"POST /api/v1/identity/login-by-email failed with {(int)response.StatusCode} {response.ReasonPhrase}: {body}");
    }

    var root = string.IsNullOrWhiteSpace(body) ? null : JsonNode.Parse(body);
    if (root is JsonObject obj &&
        obj.TryGetPropertyValue("success", out var successNode) &&
        successNode?.GetValueKind() is JsonValueKind.False)
    {
        var errors = obj["errors"]?.ToJsonString() ?? body;
        throw new InvalidOperationException($"POST /api/v1/identity/login-by-email returned success=false: {errors}");
    }

    var token = NodeString(root?["data"], "token");
    if (string.IsNullOrWhiteSpace(token))
    {
        token = NodeString(root, "token");
    }

    if (string.IsNullOrWhiteSpace(token))
    {
        throw new InvalidOperationException("POST /api/v1/identity/login-by-email did not return data.token.");
    }

    var workspace = string.IsNullOrWhiteSpace(options.Workspace)
        ? await ResolveWorkspaceIdAsync(http, token)
        : options.Workspace;
    var (organization, organizationKey) = string.IsNullOrWhiteSpace(options.Organization)
        ? await ResolveOrganizationAsync(http, token, workspace)
        : (options.Organization, options.OrganizationKey);

    return options with
    {
        AccessToken = token,
        AuthMode = "bearer",
        Workspace = workspace,
        Organization = organization,
        OrganizationKey = string.IsNullOrWhiteSpace(organizationKey) ? options.OrganizationKey : organizationKey
    };
}

static async Task<string> ResolveWorkspaceIdAsync(HttpClient http, string token)
{
    var workspaces = await SendAuthenticatedAsync(http, token, null, "/api/v1/user/workspaces");
    var workspace = workspaces as JsonArray ?? throw new InvalidOperationException("GET /api/v1/user/workspaces did not return an array.");
    var id = workspace.Select(x => NodeString(x, "id")).FirstOrDefault(x => !string.IsNullOrWhiteSpace(x));
    return string.IsNullOrWhiteSpace(id)
        ? throw new InvalidOperationException("GET /api/v1/user/workspaces did not return a workspace id.")
        : id;
}

static async Task<(string Id, string Key)> ResolveOrganizationAsync(HttpClient http, string token, string workspaceId)
{
    var organizations = await SendAuthenticatedAsync(http, token, workspaceId, "/api/v1/organizations?isSsoFirstLogin=false");
    var organization = organizations as JsonArray ?? throw new InvalidOperationException("GET /api/v1/organizations did not return an array.");
    var first = organization.FirstOrDefault(x => !string.IsNullOrWhiteSpace(NodeString(x, "id")))
        ?? throw new InvalidOperationException("GET /api/v1/organizations did not return an organization id.");
    return (NodeString(first, "id"), NodeString(first, "key"));
}

static async Task<JsonNode?> SendAuthenticatedAsync(HttpClient http, string token, string? workspaceId, string path)
{
    using var request = new HttpRequestMessage(HttpMethod.Get, path);
    request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", token);
    if (!string.IsNullOrWhiteSpace(workspaceId))
    {
        request.Headers.TryAddWithoutValidation("Workspace", workspaceId);
    }

    var response = await http.SendAsync(request);
    var body = await response.Content.ReadAsStringAsync();
    if (!response.IsSuccessStatusCode)
    {
        throw new HttpRequestException($"GET {path} failed with {(int)response.StatusCode} {response.ReasonPhrase}: {body}");
    }

    var root = string.IsNullOrWhiteSpace(body) ? null : JsonNode.Parse(body);
    if (root is JsonObject obj &&
        obj.TryGetPropertyValue("success", out var successNode) &&
        successNode?.GetValueKind() is JsonValueKind.False)
    {
        var errors = obj["errors"]?.ToJsonString() ?? body;
        throw new InvalidOperationException($"GET {path} returned success=false: {errors}");
    }

    return root is JsonObject wrapper && wrapper.TryGetPropertyValue("data", out var data)
        ? data
        : root;
}

static string NormalizeOpenApiPath(string path) =>
    Regex.Replace(path, "\\{[^}/]+\\}", "{}", RegexOptions.CultureInvariant);

static string BuildPlanMarkdown(string dataSetId, FlagSpec[] flags)
{
    var sb = new StringBuilder();
    sb.AppendLine("# FeatBit REST API E2E Execution Plan");
    sb.AppendLine();
    sb.AppendLine($"Fixed data set: `{dataSetId}`");
    sb.AppendLine($"Metric suffix: `{dataSetId.Replace('-', '_')}`");
    sb.AppendLine();
    sb.AppendLine("## Feature Flags");
    sb.AppendLine();
    sb.AppendLine("| Key | Type | Initial status | Enabled variation | Disabled variation |");
    sb.AppendLine("| --- | --- | --- | --- | --- |");
    foreach (var flag in flags)
    {
        var enabled = flag.Variations.First(x => x.Id == flag.EnabledVariationId);
        var disabled = flag.Variations.First(x => x.Id == flag.DisabledVariationId);
        sb.AppendLine(
            $"| `{flag.Key}` | `{flag.VariationType}` | `{flag.IsEnabled}` | `{enabled.Name}` = `{enabled.Value}` | `{disabled.Name}` = `{disabled.Value}` |");
    }

    sb.AppendLine();
    sb.AppendLine("## Expected Final Feature Flag State");
    sb.AppendLine();
    sb.AppendLine("| Key | Type | Final enabled | Final variants | Rule | Traffic | Experimentation |");
    sb.AppendLine("| --- | --- | --- | --- | --- | --- | --- |");
    for (var index = 0; index < flags.Length; index++)
    {
        var flag = flags[index];
        var isExperimentFlag = index == 0;
        var finalEnabled = index % 2 == 0;
        var rule = isExperimentFlag
            ? "no targeting rules"
            : "User is in segment IsOneOf [segmentId] -> first variation 100%";
        var traffic = isExperimentFlag
            ? "fallthrough control 50%, treatment 50%"
            : "fallthrough first variation 100%";
        var experimentation = isExperimentFlag
            ? "bound to release-decision experiment"
            : "not bound";

        sb.AppendLine(
            $"| `{flag.Key}` | `{flag.VariationType}` | `{finalEnabled.ToString().ToLowerInvariant()}` | {FinalVariantsMarkdown(flag, isExperimentFlag)} | {rule} | {traffic} | {experimentation} |");
    }

    sb.AppendLine();
    sb.AppendLine("## Expected Insight, Stats, And Analyze State");
    sb.AppendLine();
    sb.AppendLine("- SDK pre-verifies all 10 flags for representative users, then evaluates only the experiment flag for every synthetic user and records the exact SDK control/treatment assignment.");
    sb.AppendLine("- Experiment evidence uses the configured `--users` seed budget, requires each control/treatment variant to meet the configured `--min-users-per-variant` sample floor, and deterministically selects metric users inside each assigned variant.");
    sb.AppendLine("- Primary metric `e2e_checkout_activated_fixed_v1` evidence target: control conversions equal `Round(controlUsers * 0.30)`, treatment conversions equal `Round(treatmentUsers * 0.45)`, treatment conversion > control conversion.");
    sb.AppendLine("- Error guardrail `e2e_checkout_error_fixed_v1` evidence target: control errors equal `Round(controlUsers * 0.018)`, treatment errors equal `Round(treatmentUsers * 0.020)`, both below `5.00%`.");
    sb.AppendLine("- Latency guardrail `e2e_checkout_latency_ms_fixed_v1` evidence target: control average `340ms`, treatment average `320ms`, treatment <= control.");
    sb.AppendLine("- Analyze should set run status to `analyzing`, write non-empty `inputData` containing all three metric events, and write non-empty `analysisResult`.");
    sb.AppendLine("- Additional traffic-assignment scenarios each create an independent experiment, run, metric event, and observation window. The covered scenarios are balanced `50/50 -> use all`, skewed `90/10 -> 10/10`, skewed `80/20 -> 20/20`, and layer `30% + 50/50`.");

    sb.AppendLine();
    sb.AppendLine("## Steps And Endpoints");
    sb.AppendLine();
    AppendPlanStep(sb, "0.1", "Create project", "POST /api/v1/projects", "Record project id/key.");
    AppendPlanStep(sb, "0.2", "Create environment", "POST /api/v1/projects/{projectId}/envs", "Record env id/key and Server Key for SDK.");
    AppendPlanStep(sb, "0.3", "Verify project/env", "GET /api/v1/projects/{projectId}", "Ensure the created env belongs to the project.");
    AppendPlanStep(sb, "1", "Create 10 flags", "POST /api/v1/envs/{envId}/feature-flags", "Create boolean, string, number, and json flags.");
    AppendPlanStep(sb, "1 verify", "Verify every flag", "GET /api/v1/envs/{envId}/feature-flags/{key}", "Check key/type/variation count.");
    AppendPlanStep(sb, "2.1", "Create segment", "POST /api/v1/envs/{envId}/segments", "Create a real segment for non-experiment rule verification.");
    AppendPlanStep(sb, "2.2", "Update segment targeting", "PUT /api/v1/envs/{envId}/segments/{segmentId}/targeting", "Include deterministic synthetic users.");
    AppendPlanStep(sb, "2 batch", "Mutate every flag", "PUT /description, /tags, /toggle/{status}, /variations, /targeting", "Change description, tags, status, variants, and targeting rules.");
    AppendPlanStep(sb, "3 batch", "Verify every mutation", "GET /api/v1/envs/{envId}/feature-flags/{key}", "Check toggles, tags, variation count, rules, segment references, and fallthrough traffic.");
    AppendPlanStep(sb, "3 segment refs", "Verify segment references", "GET /api/v1/envs/{envId}/segments/{segmentId}/flag-references", "Confirm the real segment is referenced by all 9 non-experiment flags and not by the experiment flag.");
    AppendPlanStep(sb, "4", "SDK evaluation", "FeatBit.ServerSdk variation detail APIs + POST /api/public/insight/track", "Pre-verify all 10 flags for representative users; SDK events feed the insight endpoint.");
    AppendPlanStep(sb, "5", "Create experiment", "POST /api/v1/envs/{envId}/release-decision/experiments", "Bind release-decision experiment to the first boolean flag.");
    AppendPlanStep(sb, "5 update", "Fill intent/hypothesis", "PUT /api/v1/envs/{envId}/release-decision/experiments/{id}", "Persist intent, hypothesis, change, constraints, env secret, and SDK URL.");
    AppendPlanStep(sb, "6", "Configure metrics", "PUT /api/v1/envs/{envId}/release-decision/experiments/{id}/metrics", "Primary binary metric plus binary and continuous guardrails.");
    AppendPlanStep(sb, "7", "Create and configure run", "POST /runs; PUT /runs/{runId}; PUT /audience; PUT /observation-window", "Configure experiment traffic assignment and move run into collecting mode.");
    AppendPlanStep(sb, "7 seed", "Seed evaluation and metric data", "FeatBit.ServerSdk Bool/String/DoubleVariationDetail + Track", "Generate exposure, primary metric, and guardrail evidence.");
    AppendPlanStep(sb, "7 verify", "Query experiment stats", "POST /api/v1/envs/{envId}/experiment-stats/query", "Verify users, treatment conversion rate > control, and guardrail data.");
    AppendPlanStep(sb, "8", "Analyze", "POST /api/v1/envs/{envId}/release-decision/experiments/{id}/runs/{runId}/analyze", "Generate inputData and analysisResult.");
    AppendPlanStep(sb, "10", "Traffic-assignment scenarios", "POST /release-decision/experiments; POST /runs; PUT /audience; POST /experiment-stats/query; POST /analyze", "Create one independent experiment per traffic scenario and verify stats reflect run traffic assignment.");
    AppendPlanStep(sb, "11", "Final verification", "GET /api/v1/envs/{envId}/release-decision/experiments/{id}; GET /api/v1/envs/{envId}/feature-flags/{key}", "Verify analyzed run, bound flag, expected seeded result direction, and all 10 flags.");
    return sb.ToString();
}

static void AppendPlanStep(StringBuilder sb, string step, string meaning, string endpoint, string verification)
{
    if (!sb.ToString().Contains("| Step | Meaning | Endpoint | Verification |", StringComparison.Ordinal))
    {
        sb.AppendLine("| Step | Meaning | Endpoint | Verification |");
        sb.AppendLine("| --- | --- | --- | --- |");
    }

    sb.AppendLine($"| {step} | {meaning} | `{endpoint}` | {verification} |");
}

static string FinalVariantsMarkdown(FlagSpec flag, bool preserveControlTreatmentNames)
{
    var values = flag.Variations.Select(variation =>
    {
        var name = preserveControlTreatmentNames
            ? variation.Name
            : $"{variation.Name}-updated";

        return $"`{name}={variation.Value}`";
    }).ToList();

    if (flag.VariationType != "boolean")
    {
        var candidate = flag.VariationType switch
        {
            "number" => "candidate-updated=2.5",
            "json" => "candidate-updated={\"mode\":\"candidate\",\"limit\":15}",
            _ => "candidate-updated=candidate"
        };
        values.Add($"`{candidate}`");
    }

    return string.Join("<br>", values);
}

static JsonObject BuildFakeFlagJson(FlagSpec spec)
{
    var variations = new JsonArray();
    foreach (var variation in spec.Variations)
    {
        variations.Add(new JsonObject
        {
            ["id"] = variation.Id,
            ["name"] = variation.Name,
            ["value"] = variation.Value
        });
    }

    return new JsonObject
    {
        ["revision"] = Guid.NewGuid().ToString("D"),
        ["variations"] = variations,
        ["targetUsers"] = new JsonArray()
    };
}

static string FindVariationId(JsonNode? flag, string preferredName, string fallbackValue)
{
    var variations = flag?["variations"]?.AsArray();
    if (variations == null)
    {
        return "";
    }

    var byName = variations.FirstOrDefault(x =>
        string.Equals(NodeString(x, "name"), preferredName, StringComparison.OrdinalIgnoreCase));
    if (byName != null)
    {
        return NodeString(byName, "id");
    }

    var byValue = variations.FirstOrDefault(x =>
        string.Equals(NodeString(x, "value"), fallbackValue, StringComparison.OrdinalIgnoreCase));
    return byValue == null ? "" : NodeString(byValue, "id");
}

static double FindConversionRate(JsonArray variantRows, string variationId)
{
    var row = variantRows.FirstOrDefault(x =>
        string.Equals(NodeString(x, "variant"), variationId, StringComparison.OrdinalIgnoreCase));
    if (row == null)
    {
        throw new InvalidOperationException($"Stats response did not include variation '{variationId}'.");
    }

    return row["conversionRate"]?.GetValue<double>() ?? 0;
}

static long FindUsers(JsonArray variantRows, string variationId)
{
    var row = variantRows.FirstOrDefault(x =>
        string.Equals(NodeString(x, "variant"), variationId, StringComparison.OrdinalIgnoreCase));
    if (row == null)
    {
        throw new InvalidOperationException($"Stats response did not include variation '{variationId}'.");
    }

    return row["users"]?.GetValue<long>() ?? 0;
}

static long FindConversions(JsonArray variantRows, string variationId)
{
    var row = variantRows.FirstOrDefault(x =>
        string.Equals(NodeString(x, "variant"), variationId, StringComparison.OrdinalIgnoreCase));
    if (row == null)
    {
        throw new InvalidOperationException($"Stats response did not include variation '{variationId}'.");
    }

    return row["conversions"]?.GetValue<long>() ?? 0;
}

static long TargetCount(long users, double rate) =>
    (long)Math.Round(users * rate, MidpointRounding.AwayFromZero);

static double FindAverageValue(JsonArray variantRows, string variationId)
{
    var row = variantRows.FirstOrDefault(x =>
        string.Equals(NodeString(x, "variant"), variationId, StringComparison.OrdinalIgnoreCase));
    if (row == null)
    {
        throw new InvalidOperationException($"Stats response did not include variation '{variationId}'.");
    }

    return row["avgValue"]?.GetValue<double>() ?? 0;
}

static double FindSumValue(JsonArray variantRows, string variationId)
{
    var row = variantRows.FirstOrDefault(x =>
        string.Equals(NodeString(x, "variant"), variationId, StringComparison.OrdinalIgnoreCase));
    if (row == null)
    {
        throw new InvalidOperationException($"Stats response did not include variation '{variationId}'.");
    }

    return row["sumValue"]?.GetValue<double>() ?? 0;
}

static bool FallthroughTrafficMatches(JsonNode? flag, bool isExperimentFlag, string controlVariationId, string treatmentVariationId)
{
    var fallthroughVariations = flag?["fallthrough"]?["variations"]?.AsArray();
    if (fallthroughVariations == null)
    {
        return false;
    }

    if (!isExperimentFlag)
    {
        var firstVariationId = NodeString(flag?["variations"]?.AsArray().FirstOrDefault(), "id");
        return fallthroughVariations.Count == 1 &&
               NodeString(fallthroughVariations[0], "id") == firstVariationId &&
               RolloutMatches(fallthroughVariations[0], 0, 1, 1);
    }

    var control = fallthroughVariations.FirstOrDefault(x => NodeString(x, "id") == controlVariationId);
    var treatment = fallthroughVariations.FirstOrDefault(x => NodeString(x, "id") == treatmentVariationId);

    return fallthroughVariations.Count == 2 &&
           RolloutMatches(control, 0, 0.5, 0.5) &&
           RolloutMatches(treatment, 0.5, 1, 0.5);
}

static bool RolloutMatches(JsonNode? rolloutVariation, double start, double end, double exptRollout)
{
    var rollout = rolloutVariation?["rollout"]?.AsArray();
    return rollout is { Count: 2 } &&
           NearlyEqual(NodeNumeric(rollout[0]), start) &&
           NearlyEqual(NodeNumeric(rollout[1]), end) &&
           NearlyEqual(NodeDouble(rolloutVariation, "exptRollout"), exptRollout);
}

static bool NearlyEqual(double left, double right) => Math.Abs(left - right) < 0.000001;

static bool InputDataContainsMetrics(string inputData, params string[] metricEvents)
{
    if (string.IsNullOrWhiteSpace(inputData))
    {
        return false;
    }

    try
    {
        using var document = JsonDocument.Parse(inputData);
        if (!document.RootElement.TryGetProperty("metrics", out var metrics) ||
            metrics.ValueKind != JsonValueKind.Object)
        {
            return false;
        }

        return metricEvents.All(metric =>
            metrics.TryGetProperty(metric, out var metricData) &&
            metricData.ValueKind == JsonValueKind.Object &&
            metricData.EnumerateObject().Any());
    }
    catch (JsonException)
    {
        return false;
    }
}

static object BuildTargetingPayload(
    JsonNode flag,
    FlagSpec spec,
    bool isExperimentFlag,
    string? segmentId = null,
    double experimentControlTraffic = 0.5)
{
    var variations = flag["variations"]!.AsArray();
    var firstVariationId = NodeString(variations[0], "id");
    var secondVariationId = NodeString(variations[Math.Min(1, variations.Count - 1)], "id");
    experimentControlTraffic = Math.Clamp(experimentControlTraffic, 0, 1);

    object[] rules = [];
    if (!isExperimentFlag)
    {
        if (string.IsNullOrWhiteSpace(segmentId))
        {
            throw new ArgumentException("Non-experiment flag targeting requires a real segment id.", nameof(segmentId));
        }

        var condition = new
        {
            id = Guid.NewGuid().ToString("D"),
            property = "User is in segment",
            op = "IsOneOf",
            value = JsonSerializer.Serialize(new[] { segmentId })
        };

        rules =
        [
            new
            {
                id = Guid.NewGuid().ToString("D"),
                name = "E2E real segment rule",
                dispatchKey = "",
                includedInExpt = true,
                conditions = new[] { condition },
                variations = new[]
                {
                    new
                    {
                        id = firstVariationId,
                        rollout = new double[] { 0, 1 },
                        exptRollout = 1
                    }
                }
            }
        ];
    }

    object[] fallthroughVariations = isExperimentFlag
        ? new object[]
        {
            new { id = firstVariationId, rollout = new double[] { 0, experimentControlTraffic }, exptRollout = experimentControlTraffic },
            new { id = secondVariationId, rollout = new double[] { experimentControlTraffic, 1 }, exptRollout = 1 - experimentControlTraffic }
        }
        : new object[]
        {
            new { id = firstVariationId, rollout = new double[] { 0, 1 }, exptRollout = 1 }
        };

    return new
    {
        revision = NodeString(flag, "revision"),
        targeting = new
        {
            targetUsers = flag["targetUsers"]?.DeepClone() ?? new JsonArray(),
            rules,
            fallthrough = new
            {
                dispatchKey = "",
                includedInExpt = true,
                variations = fallthroughVariations
            },
            exptIncludeAllTargets = true
        },
        comment = "E2E targeting mutation"
    };
}

static async Task<SdkSeedSummary> SeedWithSdkAsync(
    E2ERun run,
    FlagSpec[] flags,
    E2EOptions options,
    TestReport report)
{
    var sdkOptions = new FbOptionsBuilder(run.EnvServerSecret)
        .Event(new Uri(options.EventUrl))
        .Streaming(new Uri(options.StreamingUrl))
        .StartWaitTime(TimeSpan.FromSeconds(options.SdkStartWaitSeconds))
        .MaxEventPerRequest(options.BatchSize)
        .Build();

    var client = new FbClient(sdkOptions);
    try
    {
        if (!client.Initialized)
        {
            throw new InvalidOperationException(
                $"FeatBit SDK did not initialize. Status: {client.Status}. Check event-url, streaming-url, and generated env server secret.");
        }

        var summary = new SdkSeedSummary();
        var experimentFlag = flags[0];
        var assignments = new List<SeededExperimentUser>(options.Users);

        for (var batchStart = 0; batchStart < options.Users; batchStart += options.BatchSize)
        {
            var batchEnd = Math.Min(batchStart + options.BatchSize, options.Users);

            for (var index = batchStart; index < batchEnd; index++)
            {
                var user = BuildSyntheticUser(index);
                var detail = Evaluate(client, experimentFlag, user);
                summary.TotalEvaluations++;
                summary.Count(experimentFlag.Key, detail.ValueId, detail.ValueText);

                assignments.Add(new SeededExperimentUser(
                    index,
                    user.Key,
                    user,
                    detail.ValueId,
                    detail.ValueText));
            }

            if (!client.FlushAndWait(TimeSpan.FromSeconds(options.FlushTimeoutSeconds)))
            {
                throw new TimeoutException(
                    $"Timed out after {options.FlushTimeoutSeconds} seconds while flushing SDK events for users {batchStart}-{batchEnd - 1}.");
            }

            if (options.SeedBatchDelayMs > 0 && batchEnd < options.Users)
            {
                await Task.Delay(TimeSpan.FromMilliseconds(options.SeedBatchDelayMs));
            }
        }

        var primaryUserKeys = SelectMetricUserKeys(
            assignments,
            run.ControlVariationId,
            rate: 0.30,
            salt: run.PrimaryMetric)
            .Concat(SelectMetricUserKeys(assignments, run.TreatmentVariationId, rate: 0.45, salt: run.PrimaryMetric))
            .ToHashSet(StringComparer.Ordinal);

        var errorUserKeys = SelectMetricUserKeys(
            assignments,
            run.ControlVariationId,
            rate: 0.018,
            salt: run.ErrorMetric)
            .Concat(SelectMetricUserKeys(assignments, run.TreatmentVariationId, rate: 0.020, salt: run.ErrorMetric))
            .ToHashSet(StringComparer.Ordinal);

        for (var batchStart = 0; batchStart < assignments.Count; batchStart += options.BatchSize)
        {
            var batch = assignments.Skip(batchStart).Take(options.BatchSize).ToArray();

            foreach (var assignment in batch)
            {
                if (primaryUserKeys.Contains(assignment.UserKey))
                {
                    client.Track(assignment.User, run.PrimaryMetric);
                }

                if (errorUserKeys.Contains(assignment.UserKey))
                {
                    client.Track(assignment.User, run.ErrorMetric);
                }

                var isTreatment = string.Equals(assignment.VariationValue, "true", StringComparison.OrdinalIgnoreCase);
                var latency = isTreatment ? 320.0 : 340.0;
                client.Track(assignment.User, run.LatencyMetric, latency);
            }

            if (!client.FlushAndWait(TimeSpan.FromSeconds(options.FlushTimeoutSeconds)))
            {
                var batchEnd = Math.Min(batchStart + options.BatchSize, assignments.Count);
                throw new TimeoutException(
                    $"Timed out after {options.FlushTimeoutSeconds} seconds while flushing SDK metric events for assigned users {batchStart}-{batchEnd - 1}.");
            }

            if (options.SeedBatchDelayMs > 0 && batchStart + options.BatchSize < assignments.Count)
            {
                await Task.Delay(TimeSpan.FromMilliseconds(options.SeedBatchDelayMs));
            }
        }

        return summary;
    }
    finally
    {
        await client.CloseAsync();
    }
}

static FbUser BuildSyntheticUser(int index, string prefix = "e2e-user")
{
    var key = StableUserKey(index, prefix);
    return FbUser.Builder(key)
        .Name(key)
        .Custom("plan", index % 3 == 0 ? "enterprise" : "free")
        .Custom("country", index % 2 == 0 ? "US" : "FR")
        .Build();
}

static IEnumerable<string> SelectMetricUserKeys(
    IEnumerable<SeededExperimentUser> assignments,
    string variationId,
    double rate,
    string salt)
{
    var variationAssignments = assignments
        .Where(x => string.Equals(x.VariationId, variationId, StringComparison.OrdinalIgnoreCase))
        .ToArray();
    var target = (int)Math.Round(variationAssignments.Length * rate, MidpointRounding.AwayFromZero);

    return variationAssignments
        .OrderBy(x => StableSelectionKey(salt, x.UserKey), StringComparer.Ordinal)
        .ThenBy(x => x.Index)
        .Take(target)
        .Select(x => x.UserKey);
}

static string StableSelectionKey(string salt, string userKey)
{
    var input = Encoding.UTF8.GetBytes($"{salt}:{userKey}");
    return Convert.ToHexString(SHA256.HashData(input));
}

static EvalResult Evaluate(FbClient client, FlagSpec flag, FbUser user)
{
    return flag.VariationType switch
    {
        "boolean" => FromDetail(client.BoolVariationDetail(flag.Key, user, defaultValue: false), x => x ? "true" : "false"),
        "number" => FromDetail(client.DoubleVariationDetail(flag.Key, user, defaultValue: 0), x => x.ToString(CultureInfo.InvariantCulture)),
        "json" => FromDetail(client.StringVariationDetail(flag.Key, user, defaultValue: "{}"), x => x),
        _ => FromDetail(client.StringVariationDetail(flag.Key, user, defaultValue: ""), x => x)
    };
}

static EvalResult FromDetail<T>(EvalDetail<T> detail, Func<T, string> valueFormatter)
{
    return new EvalResult(detail.ValueId ?? "", valueFormatter(detail.Value));
}

static string StableUserKey(int index, string prefix = "e2e-user") => $"{prefix}-{index:0000}";

static string RequiredString(JsonNode? node, string property)
{
    var value = NodeString(node, property);
    if (string.IsNullOrWhiteSpace(value))
    {
        throw new InvalidOperationException($"Response is missing required property '{property}'.");
    }

    return value;
}

static string NodeString(JsonNode? node, string property)
{
    if (node is not JsonObject obj || !obj.TryGetPropertyValue(property, out var value) || value == null)
    {
        return "";
    }

    return value.GetValueKind() == JsonValueKind.String ? value.GetValue<string>() : value.ToJsonString();
}

static JsonObject? FindObjectByProperty(JsonNode? node, string property, string expectedValue)
{
    if (node is JsonObject obj)
    {
        if (string.Equals(NodeString(obj, property), expectedValue, StringComparison.OrdinalIgnoreCase))
        {
            return obj;
        }

        foreach (var child in obj.Select(x => x.Value))
        {
            var match = FindObjectByProperty(child, property, expectedValue);
            if (match != null)
            {
                return match;
            }
        }
    }

    if (node is JsonArray array)
    {
        foreach (var child in array)
        {
            var match = FindObjectByProperty(child, property, expectedValue);
            if (match != null)
            {
                return match;
            }
        }
    }

    return null;
}

static bool NodeBool(JsonNode? node, string property)
{
    if (node is not JsonObject obj || !obj.TryGetPropertyValue(property, out var value) || value == null)
    {
        return false;
    }

    return value.GetValueKind() == JsonValueKind.True ||
           (value.GetValueKind() == JsonValueKind.String && bool.TryParse(value.GetValue<string>(), out var parsed) && parsed);
}

static double NodeDouble(JsonNode? node, string property)
{
    if (node is not JsonObject obj || !obj.TryGetPropertyValue(property, out var value) || value == null)
    {
        return 0;
    }

    return NodeNumeric(value);
}

static double NodeNumeric(JsonNode? node)
{
    if (node == null)
    {
        return 0;
    }

    if (node.GetValueKind() == JsonValueKind.Number && node.GetValue<double>() is var number)
    {
        return number;
    }

    return node.GetValueKind() == JsonValueKind.String &&
           double.TryParse(node.GetValue<string>(), NumberStyles.Float, CultureInfo.InvariantCulture, out var parsed)
        ? parsed
        : 0;
}

static string FindSecret(JsonNode? env, string type)
{
    var secrets = env?["secrets"]?.AsArray();
    if (secrets == null)
    {
        return "";
    }

    foreach (var secret in secrets)
    {
        if (string.Equals(NodeString(secret, "type"), type, StringComparison.OrdinalIgnoreCase) ||
            NodeString(secret, "name").Contains(type, StringComparison.OrdinalIgnoreCase))
        {
            return NodeString(secret, "value");
        }
    }

    return "";
}

static bool HasVariation(JsonNode? flag, string name, string value)
{
    var variations = flag?["variations"]?.AsArray();
    return variations?.Any(variation =>
        string.Equals(NodeString(variation, "name"), name, StringComparison.OrdinalIgnoreCase) &&
        string.Equals(NodeString(variation, "value"), value, StringComparison.OrdinalIgnoreCase)) == true;
}

static bool HasAllStrings(JsonArray? values, IEnumerable<string> expected)
{
    if (values == null)
    {
        return false;
    }

    var actual = values
        .Select(value => value?.GetValueKind() == JsonValueKind.String ? value.GetValue<string>() : value?.ToJsonString() ?? "")
        .ToHashSet(StringComparer.Ordinal);
    return expected.All(actual.Contains);
}

static string VariationSnapshot(IEnumerable<JsonNode?> variations)
{
    return JsonSerializer.Serialize(variations.Select(variation => new
    {
        id = NodeString(variation, "id"),
        name = NodeString(variation, "name"),
        value = NodeString(variation, "value")
    }));
}

static string VariationPairsSnapshot(IEnumerable<JsonNode?> variations)
{
    return string.Join("; ", variations.Select(variation =>
        $"{NodeString(variation, "name")}={NodeString(variation, "value")}"));
}

static string DescribeSecrets(JsonNode? env)
{
    var secrets = env?["secrets"]?.AsArray();
    if (secrets == null || secrets.Count == 0)
    {
        return "none";
    }

    return string.Join(
        ", ",
        secrets.Select(secret =>
        {
            var name = NodeString(secret, "name");
            var type = NodeString(secret, "type");
            return $"name='{name}', type='{type}', hasValue={!string.IsNullOrWhiteSpace(NodeString(secret, "value"))}";
        }));
}

sealed class FeatBitApiClient
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web)
    {
        WriteIndented = false
    };

    private readonly HttpClient _http;
    private readonly TestReport _report;

    public FeatBitApiClient(E2EOptions options, TestReport report)
    {
        _report = report;
        _http = new HttpClient
        {
            BaseAddress = new Uri(options.ApiUrl)
        };

        if (options.AuthMode == "bearer")
        {
            _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", options.AccessToken);
        }
        else
        {
            _http.DefaultRequestHeaders.TryAddWithoutValidation("Authorization", options.AccessToken);
        }

        if (!string.IsNullOrWhiteSpace(options.Organization))
        {
            _http.DefaultRequestHeaders.TryAddWithoutValidation("Organization", options.Organization);
        }

        if (!string.IsNullOrWhiteSpace(options.Workspace))
        {
            _http.DefaultRequestHeaders.TryAddWithoutValidation("Workspace", options.Workspace);
        }
    }

    public async Task<JsonNode?> SendAsync(
        HttpMethod method,
        string path,
        object? payload,
        string name,
        string meaning)
    {
        using var request = new HttpRequestMessage(method, path);
        if (payload != null)
        {
            request.Content = JsonContent.Create(payload, options: JsonOptions);
        }

        var response = await _http.SendAsync(request);
        var body = await response.Content.ReadAsStringAsync();
        var endpoint = $"{method.Method} {path}";

        if (!response.IsSuccessStatusCode)
        {
            _report.Record(name, meaning, endpoint, "FAIL", $"HTTP {(int)response.StatusCode} {response.ReasonPhrase}: {Truncate(body, 1200)}");
            throw new HttpRequestException($"{endpoint} failed with {(int)response.StatusCode} {response.ReasonPhrase}: {body}");
        }

        var root = string.IsNullOrWhiteSpace(body) ? null : JsonNode.Parse(body);
        if (root is JsonObject obj &&
            obj.TryGetPropertyValue("success", out var successNode) &&
            successNode?.GetValueKind() is JsonValueKind.False)
        {
            var errors = obj["errors"]?.ToJsonString() ?? body;
            _report.Record(name, meaning, endpoint, "FAIL", Truncate(errors, 1200));
            throw new InvalidOperationException($"{endpoint} returned success=false: {errors}");
        }

        _report.Record(name, meaning, endpoint, "PASS", "HTTP " + (int)response.StatusCode);
        return root is JsonObject wrapper && wrapper.TryGetPropertyValue("data", out var data)
            ? data
            : root;
    }

    private static string Truncate(string value, int max) =>
        value.Length <= max ? value : value[..max] + "...";
}

sealed record E2EOptions(
    string ApiUrl,
    string EventUrl,
    string StreamingUrl,
    string AccessToken,
    string LoginEmail,
    string LoginPassword,
    string AuthMode,
    string Organization,
    string OrganizationKey,
    string Workspace,
    string ProjectKey,
    string EnvId,
    string ReportDir,
    int Users,
    int MinUsersPerVariant,
    int BatchSize,
    int SdkStartWaitSeconds,
    int FlushTimeoutSeconds,
    int PostSdkWaitSeconds,
    int SeedBatchDelayMs,
    bool Cleanup)
{
    public static E2EOptions Parse(string[] args)
    {
        var bag = ArgBag.Parse(args);
        var apiUrl = NormalizeBaseUrl(Get(bag, "api-url", Env("FEATBIT_API_URL", "https://app-api.featbit.co")));
        var eventUrl = NormalizeBaseUrl(Get(bag, "event-url", Env("FEATBIT_EVENT_URL", "https://app-eval.featbit.co")));
        var streamingUrl = NormalizeBaseUrl(Get(bag, "streaming-url", Env("FEATBIT_STREAMING_URL", ToStreamingUrl(eventUrl))));
        var token = Get(bag, "access-token", Env("FEATBIT_ACCESS_TOKEN", ""));
        var loginEmail = Get(bag, "login-email", Env("FEATBIT_LOGIN_EMAIL", ""));
        var loginPassword = Get(bag, "login-password", Env("FEATBIT_LOGIN_PASSWORD", ""));

        var projectKey = Get(bag, "project-key", Env("FEATBIT_PROJECT_KEY", ""));
        var envId = Get(bag, "env-id", Env("FEATBIT_ENV_ID", ""));
        if (string.IsNullOrWhiteSpace(projectKey) != string.IsNullOrWhiteSpace(envId))
        {
            throw new ArgumentException("--project-key and --env-id must be provided together when using an existing project/environment.");
        }

        var users = GetInt(bag, "users", 1500, min: 20);
        var minUsersPerVariant = GetInt(bag, "min-users-per-variant", 500, min: 1);
        if (users < minUsersPerVariant * 2)
        {
            throw new ArgumentException($"--users must be at least twice --min-users-per-variant. users={users}, minUsersPerVariant={minUsersPerVariant}.");
        }

        return new E2EOptions(
            apiUrl,
            eventUrl,
            streamingUrl,
            token,
            loginEmail,
            loginPassword,
            Get(bag, "auth-mode", Env("FEATBIT_AUTH_MODE", "raw")).ToLowerInvariant(),
            Get(bag, "organization", Env("FEATBIT_ORGANIZATION", "")),
            Get(bag, "organization-key", Env("FEATBIT_ORGANIZATION_KEY", "playground")),
            Get(bag, "workspace", Env("FEATBIT_WORKSPACE", "")),
            projectKey,
            envId,
            Get(bag, "report-dir", Env("FEATBIT_REPORT_DIR", "integration-tests/featbit-rest-api-e2e/reports")),
            users,
            minUsersPerVariant,
            GetInt(bag, "batch-size", 10, min: 1),
            GetInt(bag, "sdk-start-wait-seconds", 10, min: 1),
            GetInt(bag, "flush-timeout-seconds", 30, min: 1),
            GetInt(bag, "post-sdk-wait-seconds", 8, min: 0),
            GetInt(bag, "seed-batch-delay-ms", 100, min: 0),
            GetBool(bag, "cleanup", false));
    }

    public static void PrintUsage()
    {
        Console.WriteLine("""
        FeatBit REST API + .NET SDK E2E runner.

        Required:
          --access-token <token> or FEATBIT_ACCESS_TOKEN
          OR --login-email <email> and --login-password <password>

        Common options:
          --api-url https://app-api.featbit.co
          --event-url https://app-eval.featbit.co
          --streaming-url wss://app-eval.featbit.co
          --login-email test@featbit.com
          --login-password 123456
          --auth-mode raw|bearer
          --organization <organization-id>
          --organization-key <organization-key>
          --workspace <workspace-id>
          --project-key <project-key>   Use an existing user-created project instead of creating one.
          --env-id <environment-id>     Required with --project-key; use an existing environment.
          --users 1500
          --min-users-per-variant 500
          --batch-size 10
          --seed-batch-delay-ms 100
          --post-sdk-wait-seconds 8
          --cleanup true|false
          --report-dir integration-tests/featbit-rest-api-e2e/reports
          --self-check
          --print-plan
          --openapi-preflight
          --swagger-url https://app-api.featbit.co/swagger/OpenApi/swagger.json
          --plan-suffix fixed-v1

        Local service example:
          dotnet run integration-tests/featbit-rest-api-e2e/featbit-rest-api-e2e.cs -- \
            --api-url http://localhost:5000 \
            --event-url http://localhost:5100 \
            --streaming-url ws://localhost:5100 \
            --login-email test@featbit.com \
            --login-password 123456

        Offline self-check:
          dotnet run integration-tests/featbit-rest-api-e2e/featbit-rest-api-e2e.cs -- --self-check

        Offline execution plan:
          dotnet run integration-tests/featbit-rest-api-e2e/featbit-rest-api-e2e.cs -- --print-plan --plan-suffix fixed-v1

        OpenAPI preflight:
          dotnet run integration-tests/featbit-rest-api-e2e/featbit-rest-api-e2e.cs -- --openapi-preflight
        """);
    }

    private static string Env(string key, string fallback) =>
        Environment.GetEnvironmentVariable(key) is { Length: > 0 } value ? value : fallback;

    private static string Get(ArgBag bag, string key, string fallback) =>
        bag.Last(key) is { Length: > 0 } value ? value : fallback;

    private static int GetInt(ArgBag bag, string key, int fallback, int min)
    {
        var value = bag.Last(key);
        var parsed = int.TryParse(value, NumberStyles.Integer, CultureInfo.InvariantCulture, out var number)
            ? number
            : fallback;
        return parsed < min ? throw new ArgumentException($"--{key} must be >= {min}.") : parsed;
    }

    private static bool GetBool(ArgBag bag, string key, bool fallback)
    {
        var value = bag.Last(key);
        return value == null ? fallback : bool.Parse(value);
    }

    private static string NormalizeBaseUrl(string value) => new Uri(value).ToString().TrimEnd('/');

    private static string ToStreamingUrl(string eventUrl)
    {
        var builder = new UriBuilder(eventUrl)
        {
            Scheme = new Uri(eventUrl).Scheme switch
            {
                "http" => "ws",
                "https" => "wss",
                "ws" or "wss" => new Uri(eventUrl).Scheme,
                var scheme => throw new ArgumentException($"Cannot derive streaming URL from scheme '{scheme}'.")
            }
        };

        return builder.Uri.ToString().TrimEnd('/');
    }
}

sealed class E2ERun
{
    public const string FixedDataSetId = "fixed-v1";

    public E2ERun(E2EOptions options)
    {
        DataSetId = FixedDataSetId;
        MetricSuffix = DataSetId.Replace('-', '_');
        ProjectKey = string.IsNullOrWhiteSpace(options.ProjectKey) ? $"e2e-api-{DataSetId}" : options.ProjectKey;
        EnvKey = $"e2e-env-{DataSetId}";
        EnvId = options.EnvId;
        OrganizationKey = options.OrganizationKey;
        SegmentKey = $"e2e-segment-{DataSetId}";
        PrimaryMetric = $"e2e_checkout_activated_{MetricSuffix}";
        ErrorMetric = $"e2e_checkout_error_{MetricSuffix}";
        LatencyMetric = $"e2e_checkout_latency_ms_{MetricSuffix}";
    }

    public string DataSetId { get; }
    public string Suffix => DataSetId;
    public string MetricSuffix { get; }
    public string ProjectKey { get; }
    public string EnvKey { get; set; }
    public string OrganizationKey { get; }
    public string SegmentKey { get; }
    public string SegmentScope => $"organization/{OrganizationKey}:project/{ProjectKey}:env/{EnvKey}";
    public string PrimaryMetric { get; }
    public string ErrorMetric { get; }
    public string LatencyMetric { get; }
    public string ProjectId { get; set; } = "";
    public string EnvId { get; set; } = "";
    public string EnvServerSecret { get; set; } = "";
    public string SegmentId { get; set; } = "";
    public string ExperimentId { get; set; } = "";
    public string RunId { get; set; } = "";
    public string ControlVariationId { get; set; } = "";
    public string TreatmentVariationId { get; set; } = "";
    public double ControlPrimaryRate { get; set; }
    public double TreatmentPrimaryRate { get; set; }
    public double ControlErrorRate { get; set; }
    public double TreatmentErrorRate { get; set; }
    public double ControlLatencyMs { get; set; }
    public double TreatmentLatencyMs { get; set; }
    public long PreExperimentSdkEvaluations { get; set; }
    public int PreExperimentNonExperimentRuleHits { get; set; }
    public long PrimaryMetricUsersObserved { get; set; }
    public int PrimaryMetricVariantRows { get; set; }
    public long ControlPrimaryUsersObserved { get; set; }
    public long TreatmentPrimaryUsersObserved { get; set; }
    public long ControlPrimaryConversionsObserved { get; set; }
    public long TreatmentPrimaryConversionsObserved { get; set; }
    public long ErrorMetricUsersObserved { get; set; }
    public int ErrorMetricVariantRows { get; set; }
    public long ControlErrorUsersObserved { get; set; }
    public long TreatmentErrorUsersObserved { get; set; }
    public long ControlErrorConversionsObserved { get; set; }
    public long TreatmentErrorConversionsObserved { get; set; }
    public long LatencyMetricUsersObserved { get; set; }
    public int LatencyMetricVariantRows { get; set; }
    public long ControlLatencyUsersObserved { get; set; }
    public long TreatmentLatencyUsersObserved { get; set; }
    public double ControlLatencySumObserved { get; set; }
    public double TreatmentLatencySumObserved { get; set; }
    public string AnalysisStatus { get; set; } = "";
    public bool AnalysisInputDataHasExpectedMetrics { get; set; }
    public bool AnalysisResultGenerated { get; set; }
    public bool CreatedProject { get; set; }
    public bool UseExistingProjectEnv => !string.IsNullOrWhiteSpace(ProjectKey) && !string.IsNullOrWhiteSpace(EnvId) && !CreatedProject;
    public List<FlagRecord> Flags { get; } = [];
    public List<ExpectedFinalFlagState> ExpectedFinalFlags { get; } = [];
    public List<ObservedFinalFlagState> ObservedFinalFlags { get; } = [];
    public List<TrafficScenarioResult> TrafficScenarioResults { get; } = [];
}

sealed record FlagRecord(string Key, string Type);

sealed record TrafficScenarioSpec(
    int Order,
    string Id,
    string Name,
    string Description,
    double ControlTrafficShare,
    double ControlIncludeRate,
    double TreatmentIncludeRate,
    double LayerTrafficPercent,
    double ControlConversionRate,
    double TreatmentConversionRate,
    int MinExpectedUsersPerVariant,
    bool ExpectBalancedAnalysis)
{
    public static TrafficScenarioSpec[] DefaultScenarios(E2EOptions options)
    {
        static int ScenarioFloor(E2EOptions options, int divisor) =>
            Math.Min(options.MinUsersPerVariant, Math.Max(1, options.Users / divisor));

        return
        [
            new(
                1,
                "balanced-50-50-use-all",
                "Balanced 50/50 use all",
                "Baseline: flag serves control and treatment evenly, and the run includes all served users for both variants.",
                ControlTrafficShare: 0.5,
                ControlIncludeRate: 100,
                TreatmentIncludeRate: 100,
                LayerTrafficPercent: 100,
                ControlConversionRate: 0.30,
                TreatmentConversionRate: 0.45,
                MinExpectedUsersPerVariant: options.MinUsersPerVariant,
                ExpectBalancedAnalysis: false),
            new(
                2,
                "skewed-90-10-to-10-10",
                "Skewed 90/10 sampled to 10/10",
                "Production flag serves mostly control; run analysis samples a control subset and all treatment users so analyzed evidence is balanced.",
                ControlTrafficShare: 0.9,
                ControlIncludeRate: 11.111111,
                TreatmentIncludeRate: 100,
                LayerTrafficPercent: 100,
                ControlConversionRate: 0.30,
                TreatmentConversionRate: 0.45,
                MinExpectedUsersPerVariant: ScenarioFloor(options, 20),
                ExpectBalancedAnalysis: true),
            new(
                3,
                "skewed-80-20-to-20-20",
                "Skewed 80/20 sampled to 20/20",
                "Production flag serves 80/20; run analysis samples 25% of control and all treatment users so analyzed evidence is approximately balanced.",
                ControlTrafficShare: 0.8,
                ControlIncludeRate: 25,
                TreatmentIncludeRate: 100,
                LayerTrafficPercent: 100,
                ControlConversionRate: 0.30,
                TreatmentConversionRate: 0.45,
                MinExpectedUsersPerVariant: ScenarioFloor(options, 10),
                ExpectBalancedAnalysis: true),
            new(
                4,
                "layer-30-50-50",
                "Layer 30% with 50/50 variants",
                "Layer eligibility limits the run to 30% of assignment units while actual served variation remains the source of control/treatment truth.",
                ControlTrafficShare: 0.5,
                ControlIncludeRate: 100,
                TreatmentIncludeRate: 100,
                LayerTrafficPercent: 30,
                ControlConversionRate: 0.30,
                TreatmentConversionRate: 0.45,
                MinExpectedUsersPerVariant: ScenarioFloor(options, 15),
                ExpectBalancedAnalysis: false)
        ];
    }
}

sealed record TrafficScenarioResult(
    string Id,
    string Name,
    string ExperimentId,
    string RunId,
    string MetricEvent,
    double ControlTrafficShare,
    double ControlIncludeRate,
    double TreatmentIncludeRate,
    double LayerTrafficPercent,
    long ControlUsers,
    long TreatmentUsers,
    long ControlConversions,
    long TreatmentConversions);

sealed record TrafficScenarioSeedSummary(long ControlAssignments, long TreatmentAssignments)
{
    public override string ToString() =>
        $"rawAssignments control={ControlAssignments}, treatment={TreatmentAssignments}";
}

sealed record ObservedFinalFlagState(
    string Key,
    string Type,
    bool FinalEnabled,
    string FinalVariations,
    string RuleProperty,
    string RuleValue,
    string RuleTraffic,
    string FallthroughTraffic,
    bool RuleIncludedInExperiment,
    bool FallthroughIncludedInExperiment,
    bool ExperimentIncludeAllTargets,
    string Experimentation);

sealed record ExpectedFinalFlagState(
    string Key,
    string Type,
    bool FinalEnabled,
    string FinalVariations,
    string RuleProperty,
    string RuleValueTemplate,
    string RuleTraffic,
    string FallthroughTraffic,
    bool IncludedInExperiment,
    bool ExperimentIncludeAllTargets,
    string Experimentation)
{
    public static ExpectedFinalFlagState[] Build(IReadOnlyList<FlagSpec> flags)
    {
        return flags.Select((flag, index) =>
        {
            var isExperimentFlag = index == 0;
            return new ExpectedFinalFlagState(
                flag.Key,
                flag.VariationType,
                FinalEnabled: index % 2 == 0,
                FinalVariations: ExpectedVariationPairs(flag, isExperimentFlag),
                RuleProperty: isExperimentFlag ? "" : "User is in segment",
                RuleValueTemplate: isExperimentFlag ? "" : "{segmentId}",
                RuleTraffic: isExperimentFlag ? "no targeting rules" : "100% first variation from real segment rule",
                FallthroughTraffic: isExperimentFlag ? "50% control, 50% treatment" : "100% first variation",
                IncludedInExperiment: !isExperimentFlag,
                ExperimentIncludeAllTargets: true,
                Experimentation: isExperimentFlag ? "bound" : "not-bound");
        }).ToArray();
    }

    private static string ExpectedVariationPairs(FlagSpec flag, bool preserveControlTreatmentNames)
    {
        var pairs = flag.Variations.Select(variation =>
        {
            var name = preserveControlTreatmentNames ? variation.Name : $"{variation.Name}-updated";
            return $"{name}={variation.Value}";
        }).ToList();

        if (flag.VariationType != "boolean")
        {
            pairs.Add($"candidate-updated={flag.VariationType switch
            {
                "number" => "2.5",
                "json" => "{\"mode\":\"candidate\",\"limit\":15}",
                _ => "candidate"
            }}");
        }

        return string.Join("; ", pairs);
    }
}

sealed record VariationSpec(string Id, string Name, string Value);

sealed record FlagSpec(
    string Name,
    string Key,
    string VariationType,
    bool IsEnabled,
    VariationSpec[] Variations,
    string EnabledVariationId,
    string DisabledVariationId)
{
    public object ToCreatePayload() => new
    {
        name = Name,
        key = Key,
        isEnabled = IsEnabled,
        description = $"Generated E2E {VariationType} flag",
        variationType = VariationType,
        variations = Variations.Select(x => new { id = x.Id, name = x.Name, value = x.Value }).ToArray(),
        enabledVariationId = EnabledVariationId,
        disabledVariationId = DisabledVariationId,
        tags = new[] { "e2e", VariationType }
    };

    public List<JsonNode?> BuildUpdatedVariations(bool preserveControlTreatmentNames, List<JsonNode?> current)
    {
        foreach (var item in current.OfType<JsonObject>())
        {
            var currentName = GetString(item, "name");
            if (preserveControlTreatmentNames &&
                (currentName.Equals("control", StringComparison.OrdinalIgnoreCase) ||
                 currentName.Equals("treatment", StringComparison.OrdinalIgnoreCase)))
            {
                continue;
            }

            item["name"] = $"{currentName}-updated";
        }

        if (VariationType != "boolean")
        {
            current.Add(new JsonObject
            {
                ["id"] = Guid.NewGuid().ToString("D"),
                ["name"] = "candidate-updated",
                ["value"] = VariationType switch
                {
                    "number" => "2.5",
                    "json" => "{\"mode\":\"candidate\",\"limit\":15}",
                    _ => "candidate"
                }
            });
        }

        return current;
    }

    private static string GetString(JsonNode? node, string property)
    {
        if (node is not JsonObject obj || !obj.TryGetPropertyValue(property, out var value) || value == null)
        {
            return "";
        }

        return value.GetValueKind() == JsonValueKind.String ? value.GetValue<string>() : value.ToJsonString();
    }
}

static class FlagCatalog
{
    public static FlagSpec[] Build(string dataSetId)
    {
        return
        [
            Bool("Checkout treatment", $"rd-checkout-treatment-{dataSetId}", enabled: true),
            StringFlag("Banner copy", $"rd-banner-copy-{dataSetId}", ["control", "short", "direct"]),
            NumberFlag("Price multiplier", $"rd-price-multiplier-{dataSetId}", ["1.0", "1.1", "1.2"]),
            JsonFlag("Checkout config", $"rd-checkout-config-{dataSetId}"),
            StringFlag("Onboarding flow", $"rd-onboarding-flow-{dataSetId}", ["classic", "guided", "compact"]),
            NumberFlag("Risk threshold", $"rd-risk-threshold-{dataSetId}", ["10", "25", "50"]),
            StringFlag("AI assistant route", $"rd-ai-assistant-route-{dataSetId}", ["off", "gpt-4.1-mini", "gpt-4.1"]),
            StringFlag("Notification style", $"rd-notification-style-{dataSetId}", ["quiet", "badge", "toast"]),
            StringFlag("Search ranking", $"rd-search-ranking-{dataSetId}", ["baseline", "semantic", "hybrid"]),
            Bool("Emergency kill switch", $"rd-kill-switch-{dataSetId}", enabled: false)
        ];
    }

    private static FlagSpec Bool(string name, string key, bool enabled)
    {
        var control = new VariationSpec(Guid.NewGuid().ToString("D"), "control", "false");
        var treatment = new VariationSpec(Guid.NewGuid().ToString("D"), "treatment", "true");
        return new FlagSpec(name, key, "boolean", enabled, [control, treatment], treatment.Id, control.Id);
    }

    private static FlagSpec StringFlag(string name, string key, string[] values)
    {
        var variations = values.Select((value, index) =>
            new VariationSpec(Guid.NewGuid().ToString("D"), index == 0 ? "control" : $"candidate-{index}", value)).ToArray();
        return new FlagSpec(name, key, "string", true, variations, variations[1].Id, variations[0].Id);
    }

    private static FlagSpec NumberFlag(string name, string key, string[] values)
    {
        var variations = values.Select((value, index) =>
            new VariationSpec(Guid.NewGuid().ToString("D"), index == 0 ? "control" : $"candidate-{index}", value)).ToArray();
        return new FlagSpec(name, key, "number", true, variations, variations[1].Id, variations[0].Id);
    }

    private static FlagSpec JsonFlag(string name, string key)
    {
        var control = new VariationSpec(Guid.NewGuid().ToString("D"), "control", "{\"mode\":\"control\",\"limit\":5}");
        var treatment = new VariationSpec(Guid.NewGuid().ToString("D"), "candidate-1", "{\"mode\":\"treatment\",\"limit\":10}");
        return new FlagSpec(name, key, "json", true, [control, treatment], treatment.Id, control.Id);
    }
}

sealed class SdkSeedSummary
{
    private readonly Dictionary<string, Dictionary<string, long>> _byFlag = new(StringComparer.OrdinalIgnoreCase);

    public long TotalEvaluations { get; set; }

    public void Count(string flagKey, string variationId, string value)
    {
        var label = string.IsNullOrWhiteSpace(value) ? variationId : $"{value} ({variationId})";
        if (!_byFlag.TryGetValue(flagKey, out var variations))
        {
            variations = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
            _byFlag[flagKey] = variations;
        }

        variations[label] = variations.TryGetValue(label, out var current) ? current + 1 : 1;
    }

    public override string ToString()
    {
        var lines = new List<string> { $"totalEvaluations={TotalEvaluations}" };
        foreach (var (flag, variations) in _byFlag.OrderBy(x => x.Key, StringComparer.OrdinalIgnoreCase))
        {
            lines.Add($"{flag}: {string.Join(", ", variations.Select(x => $"{x.Key}={x.Value}"))}");
        }

        return string.Join(Environment.NewLine, lines);
    }
}

sealed record EvalResult(string ValueId, string ValueText);

sealed record SeededExperimentUser(
    int Index,
    string UserKey,
    FbUser User,
    string VariationId,
    string VariationValue);

sealed class SdkValidationSummary
{
    private readonly Dictionary<string, Dictionary<string, long>> _byFlag = new(StringComparer.OrdinalIgnoreCase);

    public long TotalEvaluations { get; set; }

    public int NonExperimentRuleHits { get; set; }

    public void Count(string flagKey, string variationId, string value)
    {
        var label = string.IsNullOrWhiteSpace(value) ? variationId : $"{value} ({variationId})";
        if (!_byFlag.TryGetValue(flagKey, out var variations))
        {
            variations = new Dictionary<string, long>(StringComparer.OrdinalIgnoreCase);
            _byFlag[flagKey] = variations;
        }

        variations[label] = variations.TryGetValue(label, out var current) ? current + 1 : 1;
    }

    public override string ToString()
    {
        var lines = new List<string>
        {
            $"totalEvaluations={TotalEvaluations}",
            $"nonExperimentRuleHits={NonExperimentRuleHits}"
        };
        foreach (var (flag, variations) in _byFlag.OrderBy(x => x.Key, StringComparer.OrdinalIgnoreCase))
        {
            lines.Add($"{flag}: {string.Join(", ", variations.Select(x => $"{x.Key}={x.Value}"))}");
        }

        return string.Join(Environment.NewLine, lines);
    }
}

sealed class TestReport
{
    private readonly E2EOptions _options;
    private readonly List<ReportStep> _steps = [];
    private readonly List<string> _sensitiveValues = [];

    public TestReport(E2EOptions options)
    {
        _options = options;
        ProtectSecret(options.AccessToken);
    }

    public void ProtectSecret(string value)
    {
        if (!string.IsNullOrWhiteSpace(value) && !_sensitiveValues.Contains(value, StringComparer.Ordinal))
        {
            _sensitiveValues.Add(value);
        }
    }

    public bool Redacts(string value, params string[] rawSecrets)
    {
        var sanitized = Sanitize(value);
        return rawSecrets.All(secret =>
            string.IsNullOrWhiteSpace(secret) ||
            !sanitized.Contains(secret, StringComparison.Ordinal));
    }

    public void Record(string name, string meaning, string endpoint, string status, string details)
    {
        _steps.Add(new ReportStep(DateTimeOffset.UtcNow, name, meaning, endpoint, status, Sanitize(details)));
        Console.WriteLine($"{status}: {name}");
    }

    public void Pass(string name, string details) => Record(name, "", "", "PASS", details);

    public void Fail(string name, string details) => Record(name, "", "", "FAIL", details);

    public void Assert(bool condition, string name, string details)
    {
        if (!condition)
        {
            Record(name, "", "", "FAIL", details);
            throw new InvalidOperationException($"{name}: {Sanitize(details)}");
        }

        Record(name, "", "", "PASS", details);
    }

    public async Task<(string Markdown, string Json)> WriteAsync(E2ERun run)
    {
        var timestamp = DateTimeOffset.UtcNow.ToString("yyyyMMddHHmmss", CultureInfo.InvariantCulture);
        var markdown = Path.Combine(_options.ReportDir, $"featbit-rest-api-e2e-{timestamp}.md");
        var json = Path.Combine(_options.ReportDir, $"featbit-rest-api-e2e-{timestamp}.json");

        await File.WriteAllTextAsync(markdown, BuildMarkdown(run));
        await File.WriteAllTextAsync(json, JsonSerializer.Serialize(new
        {
            options = new
            {
                _options.ApiUrl,
                _options.EventUrl,
                _options.StreamingUrl,
                _options.AuthMode,
                _options.Users,
                _options.Cleanup
            },
            resources = new
            {
                run.Suffix,
                run.MetricSuffix,
                run.ProjectId,
                run.ProjectKey,
                run.EnvId,
                run.EnvKey,
                EnvServerSecret = Mask(run.EnvServerSecret),
                run.SegmentId,
                run.SegmentKey,
                run.SegmentScope,
                run.ExperimentId,
                run.RunId,
                run.ControlVariationId,
                run.TreatmentVariationId,
                run.PrimaryMetric,
                run.ErrorMetric,
                run.LatencyMetric,
                flags = run.Flags
            },
            expectedResults = new
            {
                primaryMetric = "treatment conversion rate > control conversion rate",
                errorGuardrail = "control and treatment error rates < 0.05",
                latencyGuardrail = "treatment average latency <= control average latency",
                analyze = "status=analyzing, inputData contains primary/error/latency metrics, analysisResult is non-empty",
                trafficScenarios = "each traffic-assignment scenario creates an independent experiment/run/metric and validates analyzed samples",
                finalFeatureFlags = run.ExpectedFinalFlags
            },
            observedResults = new
            {
                run.ControlPrimaryRate,
                run.TreatmentPrimaryRate,
                run.ControlErrorRate,
                run.TreatmentErrorRate,
                run.ControlLatencyMs,
                run.TreatmentLatencyMs,
                preExperimentSdk = new
                {
                    evaluations = run.PreExperimentSdkEvaluations,
                    nonExperimentRuleHits = run.PreExperimentNonExperimentRuleHits
                },
                primaryMetricObserved = new
                {
                    users = run.PrimaryMetricUsersObserved,
                    variants = run.PrimaryMetricVariantRows,
                    controlUsers = run.ControlPrimaryUsersObserved,
                    treatmentUsers = run.TreatmentPrimaryUsersObserved,
                    controlConversions = run.ControlPrimaryConversionsObserved,
                    treatmentConversions = run.TreatmentPrimaryConversionsObserved
                },
                errorGuardrailObserved = new
                {
                    users = run.ErrorMetricUsersObserved,
                    variants = run.ErrorMetricVariantRows,
                    controlUsers = run.ControlErrorUsersObserved,
                    treatmentUsers = run.TreatmentErrorUsersObserved,
                    controlConversions = run.ControlErrorConversionsObserved,
                    treatmentConversions = run.TreatmentErrorConversionsObserved
                },
                latencyGuardrailObserved = new
                {
                    users = run.LatencyMetricUsersObserved,
                    variants = run.LatencyMetricVariantRows,
                    controlUsers = run.ControlLatencyUsersObserved,
                    treatmentUsers = run.TreatmentLatencyUsersObserved,
                    controlSum = run.ControlLatencySumObserved,
                    treatmentSum = run.TreatmentLatencySumObserved
                },
                run.AnalysisStatus,
                run.AnalysisInputDataHasExpectedMetrics,
                run.AnalysisResultGenerated,
                trafficScenarios = run.TrafficScenarioResults,
                finalFeatureFlags = run.ObservedFinalFlags
            },
            steps = _steps
        }, new JsonSerializerOptions(JsonSerializerDefaults.Web) { WriteIndented = true }));

        return (Path.GetFullPath(markdown), Path.GetFullPath(json));
    }

    private string BuildMarkdown(E2ERun run)
    {
        var sb = new StringBuilder();
        sb.AppendLine("# FeatBit REST API E2E Report");
        sb.AppendLine();
        sb.AppendLine($"Generated: {DateTimeOffset.UtcNow:u}");
        sb.AppendLine($"API URL: `{_options.ApiUrl}`");
        sb.AppendLine($"Event URL: `{_options.EventUrl}`");
        sb.AppendLine($"Streaming URL: `{_options.StreamingUrl}`");
        sb.AppendLine();
        sb.AppendLine("## Created Resources");
        sb.AppendLine();
        sb.AppendLine($"- Fixed data set: `{run.DataSetId}`");
        sb.AppendLine($"- Metric suffix: `{run.MetricSuffix}`");
        sb.AppendLine($"- Project: `{run.ProjectKey}` / `{run.ProjectId}`");
        sb.AppendLine($"- Environment: `{run.EnvKey}` / `{run.EnvId}`");
        sb.AppendLine($"- Environment Server Key: `{Mask(run.EnvServerSecret)}`");
        sb.AppendLine($"- Segment: `{run.SegmentKey}` / `{run.SegmentId}`");
        sb.AppendLine($"- Segment Scope: `{run.SegmentScope}`");
        sb.AppendLine($"- Experiment: `{run.ExperimentId}`");
        sb.AppendLine($"- Run: `{run.RunId}`");
        sb.AppendLine();
        sb.AppendLine("## Runner Configuration");
        sb.AppendLine();
        sb.AppendLine($"- Synthetic user seed budget: `{_options.Users}`");
        sb.AppendLine($"- Per-variant sample floor: `{_options.MinUsersPerVariant}`");
        sb.AppendLine();
        sb.AppendLine("## Expected Vs Observed Results");
        sb.AppendLine();
        sb.AppendLine("| Check | Expected | Observed |");
        sb.AppendLine("| --- | --- | --- |");
        sb.AppendLine($"| Pre-experiment SDK evaluation | all flags evaluate for representative users, 9 non-experiment rule hits | evaluations `{run.PreExperimentSdkEvaluations}`, non-experiment rule hits `{run.PreExperimentNonExperimentRuleHits}` |");
        sb.AppendLine($"| Primary metric | each variant meets configured sample floor `{_options.MinUsersPerVariant}`; treatment conversion > control conversion | total users `{run.PrimaryMetricUsersObserved}`, variants `{run.PrimaryMetricVariantRows}`, control `{run.ControlPrimaryConversionsObserved}/{run.ControlPrimaryUsersObserved}` rate `{run.ControlPrimaryRate:0.####}`, treatment `{run.TreatmentPrimaryConversionsObserved}/{run.TreatmentPrimaryUsersObserved}` rate `{run.TreatmentPrimaryRate:0.####}` |");
        sb.AppendLine($"| Error guardrail | each variant meets configured sample floor `{_options.MinUsersPerVariant}`; control and treatment error rates < `0.05` | total users `{run.ErrorMetricUsersObserved}`, variants `{run.ErrorMetricVariantRows}`, control `{run.ControlErrorConversionsObserved}/{run.ControlErrorUsersObserved}` rate `{run.ControlErrorRate:0.####}`, treatment `{run.TreatmentErrorConversionsObserved}/{run.TreatmentErrorUsersObserved}` rate `{run.TreatmentErrorRate:0.####}` |");
        sb.AppendLine($"| Latency guardrail | each variant meets configured sample floor `{_options.MinUsersPerVariant}`; treatment average latency <= control average latency | total users `{run.LatencyMetricUsersObserved}`, variants `{run.LatencyMetricVariantRows}`, control users `{run.ControlLatencyUsersObserved}` sum `{run.ControlLatencySumObserved:0.####}ms` avg `{run.ControlLatencyMs:0.####}ms`, treatment users `{run.TreatmentLatencyUsersObserved}` sum `{run.TreatmentLatencySumObserved:0.####}ms` avg `{run.TreatmentLatencyMs:0.####}ms` |");
        sb.AppendLine($"| Analyze | status `analyzing`, expected metrics in `inputData`, non-empty `analysisResult` | status `{run.AnalysisStatus}`, inputData metrics `{run.AnalysisInputDataHasExpectedMetrics}`, analysisResult `{run.AnalysisResultGenerated}` |");
        sb.AppendLine();
        if (run.TrafficScenarioResults.Count > 0)
        {
            sb.AppendLine("## Traffic Assignment Scenarios");
            sb.AppendLine();
            sb.AppendLine("| Scenario | Experiment | Run | Flag split | Sampling | Layer | Observed control | Observed treatment |");
            sb.AppendLine("| --- | --- | --- | --- | --- | --- | ---: | ---: |");
            foreach (var scenario in run.TrafficScenarioResults)
            {
                sb.AppendLine(
                    $"| {Escape(scenario.Name)} (`{scenario.Id}`) | `{scenario.ExperimentId}` | `{scenario.RunId}` | control `{scenario.ControlTrafficShare:P1}`, treatment `{1 - scenario.ControlTrafficShare:P1}` | control `{scenario.ControlIncludeRate:0.######}%`, treatment `{scenario.TreatmentIncludeRate:0.######}%` | `{scenario.LayerTrafficPercent:0.######}%` | `{scenario.ControlConversions}/{scenario.ControlUsers}` | `{scenario.TreatmentConversions}/{scenario.TreatmentUsers}` |");
            }

            sb.AppendLine();
        }

        sb.AppendLine("## Metrics");
        sb.AppendLine();
        sb.AppendLine("| Role | Event | Type | Aggregation |");
        sb.AppendLine("| --- | --- | --- | --- |");
        sb.AppendLine($"| Primary | `{run.PrimaryMetric}` | `binary` | `once` |");
        sb.AppendLine($"| Guardrail | `{run.ErrorMetric}` | `binary` | `once` |");
        sb.AppendLine($"| Guardrail | `{run.LatencyMetric}` | `continuous` | `average` |");
        sb.AppendLine();
        sb.AppendLine("## Expected Final Feature Flags");
        sb.AppendLine();
        sb.AppendLine("| Key | Type | Final enabled | Final variants | Rule | Rule traffic | Fallthrough traffic | Experimentation |");
        sb.AppendLine("| --- | --- | --- | --- | --- | --- | --- | --- |");
        foreach (var flag in run.ExpectedFinalFlags)
        {
            var rule = string.IsNullOrWhiteSpace(flag.RuleProperty)
                ? "none"
                : $"{flag.RuleProperty} `{flag.RuleValueTemplate.Replace("{segmentId}", run.SegmentId, StringComparison.Ordinal)}`";
            sb.AppendLine($"| `{flag.Key}` | `{flag.Type}` | `{flag.FinalEnabled.ToString().ToLowerInvariant()}` | {flag.FinalVariations} | {rule} | {flag.RuleTraffic} | {flag.FallthroughTraffic} | `{flag.Experimentation}` |");
        }

        if (run.ObservedFinalFlags.Count > 0)
        {
            sb.AppendLine();
            sb.AppendLine("## Observed Final Feature Flags");
            sb.AppendLine();
            sb.AppendLine("| Key | Type | Final enabled | Final variants | Rule | Rule traffic | Fallthrough traffic | Experimentation |");
            sb.AppendLine("| --- | --- | --- | --- | --- | --- | --- | --- |");
            foreach (var flag in run.ObservedFinalFlags)
            {
                var rule = string.IsNullOrWhiteSpace(flag.RuleProperty) ? "none" : $"{flag.RuleProperty} `{flag.RuleValue}`";
                sb.AppendLine($"| `{flag.Key}` | `{flag.Type}` | `{flag.FinalEnabled.ToString().ToLowerInvariant()}` | {flag.FinalVariations} | {rule} | {flag.RuleTraffic} | {flag.FallthroughTraffic}; rule included `{flag.RuleIncludedInExperiment}`; fallthrough included `{flag.FallthroughIncludedInExperiment}`; all targets `{flag.ExperimentIncludeAllTargets}` | `{flag.Experimentation}` |");
            }
        }

        sb.AppendLine();
        sb.AppendLine("## Steps");
        sb.AppendLine();
        sb.AppendLine("| Time | Status | Step | Endpoint | Meaning | Details |");
        sb.AppendLine("| --- | --- | --- | --- | --- | --- |");
        foreach (var step in _steps)
        {
            sb.AppendLine(
                $"| {step.Time:u} | {step.Status} | {Escape(step.Name)} | `{Escape(step.Endpoint)}` | {Escape(step.Meaning)} | {Escape(step.Details)} |");
        }

        return sb.ToString();
    }

    private string Sanitize(string value)
    {
        var sanitized = value ?? "";
        foreach (var secret in _sensitiveValues)
        {
            sanitized = sanitized.Replace(secret, Mask(secret), StringComparison.Ordinal);
        }

        return sanitized;
    }

    private static string Mask(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return "";
        }

        return value.Length <= 8
            ? "****"
            : $"{value[..4]}****{value[^4..]}";
    }

    private static string Escape(string? value) =>
        (value ?? "").Replace("|", "\\|").Replace("\r", " ").Replace("\n", "<br>");
}

sealed record ReportStep(
    DateTimeOffset Time,
    string Name,
    string Meaning,
    string Endpoint,
    string Status,
    string Details);

sealed record OpenApiOperation(string Method, string Path);

sealed class ArgBag
{
    private readonly Dictionary<string, List<string>> _values = new(StringComparer.OrdinalIgnoreCase);

    public static ArgBag Parse(string[] args)
    {
        var bag = new ArgBag();

        for (var i = 0; i < args.Length; i++)
        {
            if (!args[i].StartsWith("--", StringComparison.Ordinal))
            {
                continue;
            }

            var raw = args[i][2..];
            var equals = raw.IndexOf('=', StringComparison.Ordinal);
            if (equals > 0)
            {
                bag.Add(raw[..equals], raw[(equals + 1)..]);
                continue;
            }

            if (i + 1 >= args.Length || args[i + 1].StartsWith("--", StringComparison.Ordinal))
            {
                bag.Add(raw, "true");
            }
            else
            {
                bag.Add(raw, args[++i]);
            }
        }

        return bag;
    }

    public string? Last(string key) =>
        _values.TryGetValue(key, out var values) && values.Count > 0 ? values[^1] : null;

    private void Add(string key, string value)
    {
        if (!_values.TryGetValue(key, out var values))
        {
            values = [];
            _values[key] = values;
        }

        values.Add(value);
    }
}
