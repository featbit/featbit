namespace Streaming.Insights;

public class InsightsOptions
{
    public const string Insights = nameof(Insights);

    /// <summary>
    /// Drop evaluation insights for flags with insights disabled. Set to false to restore the behavior from
    /// before the per-flag setting existed.
    /// </summary>
    public bool FilterByFlagSetting { get; set; } = true;

    /// <summary>
    /// How long a loaded environment's disabled-flag set is trusted before it is reloaded from the store.
    /// Flag change messages keep it current in between; the reload is a safety net for missed messages.
    /// </summary>
    public int SettingCacheTtlSeconds { get; set; } = 300;
}
