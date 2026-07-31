using Xunit;

// Integration tests share process-wide state (System.Diagnostics.Metrics meters used by the
// commit coordinator + recovery workers, plus a single Mongo and Redis host). Running test
// classes in parallel causes MeterListener collectors in one test to capture measurements
// emitted by tests in sibling classes, producing spurious assertion failures. Serialize the
// whole assembly to keep each test's observability assertions deterministic.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
