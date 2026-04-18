using Application.Usages;
using Application.Workspaces;
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

    public async Task<WorkspaceUsageVm> GetUsageAsync(Guid workspaceId, WorkspaceUsageFilter filter)
    {
        var envs = await FetchWorkspaceEnvs();
        if (envs.Length == 0)
        {
            return new WorkspaceUsageVm(
                new UsageSummaryVm(0, 0, 0, 0, 0, 0),
                [],
                []
            );
        }

        const string query =
            """
            -- 1. Current Unique Users
            SELECT COUNT(*)
            FROM usage_end_user_stats
            WHERE env_id = ANY(@EnvIds) AND first_seen_at >= @StartDate AND first_seen_at <= @EndDate;

            -- 2. Current flag evaluations & custom metrics
            SELECT COALESCE(SUM(flag_evaluations), 0) AS flag_evaluations,
                   COALESCE(SUM(custom_metrics), 0)   AS custom_metrics
            FROM usage_event_stats
            WHERE env_id = ANY(@EnvIds)
                AND stats_date >= @StartDate AND stats_date <= @EndDate;

            -- 3. Previous Unique Users
            SELECT COUNT(*)
            FROM usage_end_user_stats
            WHERE env_id = ANY(@EnvIds) AND first_seen_at >= @PrevStartDate AND first_seen_at <= @PrevEndDate;

            -- 4. Previous flag evaluations & custom metrics
            SELECT COALESCE(SUM(flag_evaluations), 0) AS flag_evaluations,
                   COALESCE(SUM(custom_metrics), 0)   AS custom_metrics
            FROM usage_event_stats
            WHERE env_id = ANY(@EnvIds)
                AND stats_date >= @PrevStartDate AND stats_date <= @PrevEndDate;

            -- 5. Daily new users
            SELECT first_seen_at AS date, COUNT(*)::int AS new_users
            FROM usage_end_user_stats
            WHERE env_id = ANY(@EnvIds) AND first_seen_at >= @StartDate AND first_seen_at <= @EndDate
            GROUP BY first_seen_at
            ORDER BY first_seen_at;

            -- 6. Daily flag evaluations & custom metrics
            SELECT stats_date AS date,
                   SUM(flag_evaluations) AS flag_evaluations,
                   SUM(custom_metrics)   AS custom_metrics
            FROM usage_event_stats
            WHERE env_id = ANY(@EnvIds)
                AND stats_date >= @StartDate AND stats_date <= @EndDate
            GROUP BY stats_date
            ORDER BY stats_date;

            -- 7. Per-environment MAU
            SELECT env_id, COUNT(*)::int AS mau
            FROM usage_end_user_stats
            WHERE env_id = ANY(@EnvIds) AND first_seen_at >= @StartDate AND first_seen_at <= @EndDate
            GROUP BY env_id;

            -- 8. Per-environment flag evaluations & custom metrics
            SELECT env_id,
                   COALESCE(SUM(flag_evaluations), 0) AS flag_evaluations,
                   COALESCE(SUM(custom_metrics), 0)   AS custom_metrics
            FROM usage_event_stats
            WHERE env_id = ANY(@EnvIds)
                AND stats_date >= @StartDate AND stats_date <= @EndDate
            GROUP BY env_id;
            """;

        var (startDate, endDate, prevStartDate, prevEndDate) = filter;

        var parameters = new
        {
            EnvIds = envs.Select(x => (Guid)x.env_id).ToArray(),
            StartDate = startDate.ToDateTime(TimeOnly.MinValue),
            EndDate = endDate.ToDateTime(TimeOnly.MinValue),
            PrevStartDate = prevStartDate.ToDateTime(TimeOnly.MinValue),
            PrevEndDate = prevEndDate.ToDateTime(TimeOnly.MinValue)
        };

        await using var multi = await DbConnection.QueryMultipleAsync(query, parameters);

        // 1. Current MAU
        var mau = await multi.ReadSingleAsync<int>();

        // 2. Current events
        var currentEvents = await multi.ReadSingleAsync();

        // 3. Previous MAU
        var prevMau = await multi.ReadSingleAsync<int>();

        // 4. Previous events
        var prevEvents = await multi.ReadSingleAsync();

        var summary = new UsageSummaryVm(
            mau,
            (long)currentEvents.flag_evaluations,
            (long)currentEvents.custom_metrics,
            prevMau,
            (long)prevEvents.flag_evaluations,
            (long)prevEvents.custom_metrics
        );

        // 5. Daily new users
        var dailyNewUsers = (await multi.ReadAsync())
            .ToDictionary(
                x => DateOnly.FromDateTime((DateTime)x.date),
                x => (int)x.new_users
            );

        // 6. Daily events
        var dailyEvents = (await multi.ReadAsync())
            .ToDictionary(
                x => DateOnly.FromDateTime((DateTime)x.date),
                x => ((long)x.flag_evaluations, (long)x.custom_metrics)
            );

        // Merge the two daily series by date
        var allDates = dailyNewUsers.Keys.Union(dailyEvents.Keys).OrderBy(d => d);
        var dailyTrend = allDates.Select(date =>
        {
            dailyEvents.TryGetValue(date, out var ev);
            return new DailyTrendItemVm(
                date,
                dailyNewUsers.GetValueOrDefault(date),
                ev.Item1,
                ev.Item2
            );
        }).ToArray();

        // 7 & 8. Per-environment breakdown (join env details with per-env stats in C#)
        var perEnvMau = (await multi.ReadAsync())
            .ToDictionary(x => (Guid)x.env_id, x => (int)x.mau);

        var perEnvEvents = (await multi.ReadAsync())
            .ToDictionary(
                x => (Guid)x.env_id,
                x => ((long)x.flag_evaluations, (long)x.custom_metrics)
            );

        var envUsages = envs.Select(env =>
            {
                var envId = (Guid)env.env_id;
                perEnvMau.TryGetValue(envId, out var envMau);
                perEnvEvents.TryGetValue(envId, out var envEvents);
                return new EnvironmentUsageVm(
                    (string)env.org_name,
                    (string)env.project_name,
                    (string)env.env_name,
                    envId,
                    envMau,
                    envEvents.Item1,
                    envEvents.Item2
                );
            })
            .OrderByDescending(e => e.Mau)
            .ToArray();

        return new WorkspaceUsageVm(summary, dailyTrend, envUsages);

        async Task<dynamic[]> FetchWorkspaceEnvs()
        {
            var results = await DbConnection.QueryAsync(
                """
                SELECT e.id AS env_id, o.name AS org_name, p.name AS project_name, e.name AS env_name
                FROM environments e
                    JOIN projects p ON e.project_id = p.id
                    JOIN organizations o ON p.organization_id = o.id
                WHERE o.workspace_id = @WorkspaceId
                """, new { WorkspaceId = workspaceId }
            );

            return results.ToArray();
        }
    }
}