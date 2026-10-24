using Domain.AccessTokens;
using Domain.AuditLogs;
using Domain.Bases;
using Domain.EndUsers;
using Domain.ExperimentMetrics;
using Domain.Experiments;
using Domain.FeatureFlags;
using Domain.FlagChangeRequests;
using Domain.FlagDrafts;
using Domain.FlagRevisions;
using Domain.FlagSchedules;
using Domain.Groups;
using Domain.Members;
using Domain.Organizations;
using Domain.Policies;
using Domain.Projects;
using Domain.RefreshTokens;
using Domain.RelayProxies;
using Domain.Segments;
using Domain.Triggers;
using Domain.Users;
using Domain.Webhooks;
using Domain.Workspaces;
using Environment = Domain.Environments.Environment;

namespace MongoToPostgresMigrator;

/// <summary>
/// The ordered set of entities to migrate. Ordered logical-parents-first so an
/// aborted run never leaves the database referentially broken; PostgreSQL
/// defines no foreign keys, so order does not affect insert success.
///
/// Excluded by design:
///   - GlobalUser        (shares the EndUsers collection / end_users table with EndUser)
///   - QueueMessage      (PostgreSQL-only MQ table, no MongoDB source)
///   - usage_*_stats     (analytics, composite natural keys, not domain entities)
/// </summary>
public static class MigrationPipeline
{
    /// <summary>
    /// Builds the ordered migration steps. <paramref name="copyBatchSize"/> is the
    /// rows-per-block used by the binary-COPY steps; it is supplied by the caller
    /// (from <c>IConfiguration</c>) so both batch sizes are configured the same way.
    /// <paramref name="exclude"/> optionally drops entities by name (case-insensitive)
    /// so a high-volume collection (e.g. EndUsers) can be skipped during a freeze
    /// migration and backfilled online afterwards; excluded entities are neither
    /// copied nor verified. Order of the remaining steps is preserved.
    /// </summary>
    public static IReadOnlyList<IEntityStep> Build(
        int copyBatchSize, IReadOnlySet<string>? exclude = null)
    {
        var steps = new List<IEntityStep>();

        void Add<T>(string name) where T : Entity => steps.Add(new EntityStep<T>(name));

        // Bulk COPY step for id-only-unique high-volume tables (no dedup needed).
        void AddBulkCopy<T>(string name) where T : Entity =>
            steps.Add(new BulkCopyStep<T>(name, copyBatchSize));

        // identity & workspace roots
        Add<Workspace>("Workspaces");
        Add<WorkspaceUser>("WorkspaceUsers");   // table added in v5.4.0
        Add<User>("Users");
        Add<RefreshToken>("RefreshTokens");     // table added in v5.3.0

        // org / project / environment tree
        Add<Organization>("Organizations");
        Add<OrganizationUser>("OrganizationUsers");
        Add<Project>("Projects");
        Add<Environment>("Environments");

        // IAM
        Add<Policy>("Policies");
        Add<Group>("Groups");
        Add<GroupMember>("GroupMembers");
        Add<GroupPolicy>("GroupPolicies");
        Add<MemberPolicy>("MemberPolicies");

        // flag domain
        Add<Segment>("Segments");
        Add<FeatureFlag>("FeatureFlags");
        Add<FlagDraft>("FlagDrafts");
        AddBulkCopy<FlagRevision>("FlagRevisions");
        Add<FlagSchedule>("FlagSchedules");
        Add<FlagChangeRequest>("FlagChangeRequests");
        Add<Trigger>("Triggers");

        // experimentation
        Add<ExperimentMetric>("ExperimentMetrics");
        Add<Experiment>("Experiments");

        // integrations
        Add<AccessToken>("AccessTokens");
        Add<RelayProxy>("RelayProxies");
        Add<Webhook>("Webhooks");
        Add<WebhookDelivery>("WebhookDeliveries");

        // end-user & audit (HIGH VOLUME — dominate runtime)
        Add<EndUserProperty>("EndUserProperties");
        steps.Add(new EndUserCopyStep("EndUsers", copyBatchSize));
        AddBulkCopy<AuditLog>("AuditLogs");

        if (exclude is { Count: > 0 })
        {
            // Re-wrap with an explicitly case-insensitive comparer: the documented
            // contract is case-insensitive matching, and relying on the comparer of
            // the caller's set would silently exclude nothing for an ordinal set.
            var excludeSet = new HashSet<string>(exclude, StringComparer.OrdinalIgnoreCase);
            return steps.Where(s => !excludeSet.Contains(s.Name)).ToList();
        }

        return steps;
    }

    /// <summary>
    /// The full set of entity names the pipeline knows how to migrate. Used to
    /// validate <c>Migrator:ExcludeEntities</c> so a typo is reported rather than
    /// silently ignored. Case-insensitive.
    /// </summary>
    public static IReadOnlySet<string> KnownEntityNames { get; } =
        Build(1).Select(s => s.Name).ToHashSet(StringComparer.OrdinalIgnoreCase);
}
