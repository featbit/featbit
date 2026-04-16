using Application.Usages;
using Dapper;
using Domain.Workspaces;
using Microsoft.EntityFrameworkCore;

namespace Infrastructure.Services.EntityFrameworkCore;

public class WorkspaceService(AppDbContext dbContext)
    : EntityFrameworkCoreService<Workspace>(dbContext), IWorkspaceService
{
    public async Task<bool> HasKeyBeenUsedAsync(Guid workspaceId, string key)
    {
        return await AnyAsync(ws =>
            ws.Id != workspaceId &&
            string.Equals(ws.Key.ToLower(), key.ToLower())
        );
    }

    public async Task<string> GetDefaultWorkspaceAsync()
    {
        if (await Queryable.CountAsync() != 1)
        {
            return string.Empty;
        }

        var first = await Queryable.FirstAsync();
        return first.Key;
    }

    public async Task<int> GetFeatureUsageAsync(Guid workspaceId, string feature)
    {
        return feature switch
        {
            LicenseFeatures.AutoAgents => await GetAutoAgentsUsageAsync(),
            _ => 0
        };

        async Task<int> GetAutoAgentsUsageAsync()
        {
            var usage = await DbConnection.ExecuteScalarAsync<int>(
                """
                select coalesce(sum(jsonb_array_length(auto_agents)), 0)
                from relay_proxies rp
                         join organizations org on rp.organization_id = org.id
                where org.workspace_id = @WorkspaceId
                """, new { WorkspaceId = workspaceId }
            );

            return usage;
        }
    }

    public async Task SaveRecordsAsync(AggregatedUsageRecords records)
    {
        var (recordedAt, endUsers, events) = records;

        if (endUsers.Count > 0)
        {
            List<Guid> mauEnvIds = [];
            List<string> mauUserKeys = [];
            foreach (var endUser in endUsers)
            {
                var (key, value) = endUser;

                foreach (var userKey in value)
                {
                    mauEnvIds.Add(key);
                    mauUserKeys.Add(userKey);
                }
            }

            // Record each unique user once per month (DO NOTHING on conflict preserves first_seen_at).
            await DbConnection.ExecuteAsync(
                """
                INSERT INTO usage_end_user_stats (env_id, year_month, user_key, first_seen_at)
                SELECT env_id, @YearMonth, user_key, @FirstSeenAt
                FROM unnest(
                    @EnvIds::uuid[],
                    @UserKeys::text[]
                ) AS t(env_id, user_key)
                ON CONFLICT (env_id, year_month, user_key) DO NOTHING
                """,
                new
                {
                    EnvIds = mauEnvIds.ToArray(),
                    YearMonth = recordedAt.Year * 100 + recordedAt.Month,
                    UserKeys = mauUserKeys.ToArray(),
                    // The date time must be Unspecified kind, which PG already considered as local, and so timezone conversion wasn't applied when converting to date.
                    // Check https://github.com/npgsql/npgsql/issues/4471#issuecomment-1134314277 for details.
                    // https://www.npgsql.org/doc/types/datetime.html#net-types-and-postgresql-types
                    FirstSeenAt = recordedAt.ToDateTime(TimeOnly.MinValue)
                }
            );
        }

        if (events.Count > 0)
        {
            List<Guid> envIds = [];
            List<int> flagEvaluations = [];
            List<int> customMetrics = [];
            foreach (var insight in events)
            {
                var (key, value) = insight;

                envIds.Add(key);
                flagEvaluations.Add(value.FlagEvaluations);
                customMetrics.Add(value.CustomMetrics);
            }

            // Accumulate daily flag evaluation and custom metric counts.
            // ON CONFLICT increments so multiple flushes per day are safe.
            await DbConnection.ExecuteAsync(
                """
                INSERT INTO usage_event_stats (env_id, stats_date, flag_evaluations, custom_metrics)
                SELECT env_id, @StatsDate, flag_evaluations, custom_metrics
                FROM unnest(
                    @EnvIds::uuid[],
                    @FlagEvaluations::int[],
                    @CustomMetrics::int[]
                ) AS t(env_id, flag_evaluations, custom_metrics)
                ON CONFLICT (env_id, stats_date) DO UPDATE
                    SET flag_evaluations = usage_event_stats.flag_evaluations + EXCLUDED.flag_evaluations,
                        custom_metrics   = usage_event_stats.custom_metrics   + EXCLUDED.custom_metrics
                """,
                new
                {
                    EnvIds = envIds.ToArray(),
                    // The date time must be Unspecified kind, which PG already considered as local, and so timezone conversion wasn't applied when converting to date.
                    // Check https://github.com/npgsql/npgsql/issues/4471#issuecomment-1134314277 for details.
                    // https://www.npgsql.org/doc/types/datetime.html#net-types-and-postgresql-types
                    StatsDate = recordedAt.ToDateTime(TimeOnly.MinValue),
                    FlagEvaluations = flagEvaluations.ToArray(),
                    CustomMetrics = customMetrics.ToArray()
                }
            );
        }
    }
}