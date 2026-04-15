namespace Application.Usages;

public record AggregatedUsageRecords(
    DateOnly RecordedAt,
    Dictionary<Guid, HashSet<string>> EndUsers,
    Dictionary<Guid, (int FlagEvaluations, int CustomMetrics)> Events
);

public static class UsageRecordsAggregator
{
    public static AggregatedUsageRecords[] Aggregate(List<UsageRecord> records)
    {
        var groupByRecordedAt = records.GroupBy(x => x.RecordedAt).ToArray();
        if (groupByRecordedAt.Length == 1)
        {
            // this is the most common case
            return [AggregateCore(groupByRecordedAt[0])];
        }

        var aggregationResults = new AggregatedUsageRecords[groupByRecordedAt.Length];

        for (int i = 0; i < groupByRecordedAt.Length; i++)
        {
            var group = groupByRecordedAt[i];
            aggregationResults[i] = AggregateCore(group);
        }

        return aggregationResults;

        AggregatedUsageRecords AggregateCore(IGrouping<DateOnly, UsageRecord> group)
        {
            var recordedAt = group.Key;

            var endUserRecords = new Dictionary<Guid, HashSet<string>>();
            var eventRecords = new Dictionary<Guid, (int flagEvals, int customMetrics)>();

            foreach (var record in group)
            {
                switch (record)
                {
                    case InsightsUsageRecord iur:
                        if (!endUserRecords.TryGetValue(iur.EnvId, out var endUsers))
                        {
                            endUsers = [];
                            endUserRecords[iur.EnvId] = endUsers;
                        }

                        // for end users, we only care about unique count
                        foreach (var endUser in iur.EndUsers)
                        {
                            endUsers.Add(endUser);
                        }

                        // for flag evaluations and custom metrics, we sum them up
                        var existing = eventRecords.GetValueOrDefault(iur.EnvId, (flagEvals: 0, customMetrics: 0));
                        eventRecords[iur.EnvId] = (
                            existing.flagEvals + iur.FlagEvaluations,
                            existing.customMetrics + iur.CustomMetrics
                        );
                        break;
                }
            }

            return new AggregatedUsageRecords(recordedAt, endUserRecords, eventRecords);
        }
    }
}