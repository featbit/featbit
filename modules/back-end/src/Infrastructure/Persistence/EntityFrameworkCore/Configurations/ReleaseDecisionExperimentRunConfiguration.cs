using Domain.ReleaseDecisions;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace Infrastructure.Persistence.EntityFrameworkCore.Configurations;

public class ReleaseDecisionExperimentRunConfiguration : IEntityTypeConfiguration<ReleaseDecisionExperimentRun>
{
    public void Configure(EntityTypeBuilder<ReleaseDecisionExperimentRun> builder)
    {
        builder.ToTable("release_decision_experiment_runs");

        builder.HasIndex(x => new { x.ExperimentId, x.Slug }).IsUnique();

        builder.Property(x => x.ExperimentId).HasColumnName("experiment_id");
        builder.Property(x => x.Slug).HasMaxLength(128).IsRequired();
        builder.Property(x => x.Status).HasMaxLength(64).IsRequired();
        builder.Property(x => x.Method).HasMaxLength(64);
        builder.Property(x => x.MethodReason).HasColumnName("method_reason");
        builder.Property(x => x.PrimaryMetricEvent).HasColumnName("primary_metric_event").HasMaxLength(256);
        builder.Property(x => x.MetricDescription).HasColumnName("metric_description");
        builder.Property(x => x.GuardrailEvents).HasColumnName("guardrail_events");
        builder.Property(x => x.GuardrailDescriptions).HasColumnName("guardrail_descriptions");
        builder.Property(x => x.ControlVariant).HasColumnName("control_variant").HasMaxLength(256);
        builder.Property(x => x.TreatmentVariant).HasColumnName("treatment_variant").HasMaxLength(256);
        builder.Property(x => x.TrafficAllocation).HasColumnName("traffic_allocation");
        builder.Property(x => x.MinimumSample).HasColumnName("minimum_sample");
        builder.Property(x => x.ObservationStart).HasColumnName("observation_start");
        builder.Property(x => x.ObservationEnd).HasColumnName("observation_end");
        builder.Property(x => x.PriorProper).HasColumnName("prior_proper");
        builder.Property(x => x.PriorMean).HasColumnName("prior_mean");
        builder.Property(x => x.PriorStddev).HasColumnName("prior_stddev");
        builder.Property(x => x.InputData).HasColumnName("input_data");
        builder.Property(x => x.AnalysisResult).HasColumnName("analysis_result");
        builder.Property(x => x.DecisionSummary).HasColumnName("decision_summary");
        builder.Property(x => x.DecisionReason).HasColumnName("decision_reason");
        builder.Property(x => x.WhatChanged).HasColumnName("what_changed");
        builder.Property(x => x.WhatHappened).HasColumnName("what_happened");
        builder.Property(x => x.ConfirmedOrRefuted).HasColumnName("confirmed_or_refuted");
        builder.Property(x => x.WhyItHappened).HasColumnName("why_it_happened");
        builder.Property(x => x.NextHypothesis).HasColumnName("next_hypothesis");
        builder.Property(x => x.RunId).HasColumnName("run_id").HasMaxLength(128);
        builder.Property(x => x.PrimaryMetricAgg).HasColumnName("primary_metric_agg").HasMaxLength(64);
        builder.Property(x => x.PrimaryMetricType).HasColumnName("primary_metric_type").HasMaxLength(64);
        builder.Property(x => x.TrafficPercent).HasColumnName("traffic_percent");
        builder.Property(x => x.LayerId).HasColumnName("layer_id").HasMaxLength(128);
        builder.Property(x => x.AudienceFilters).HasColumnName("audience_filters");
        builder.Property(x => x.TrafficOffset).HasColumnName("traffic_offset");
        builder.Property(x => x.LayerKey).HasColumnName("layer_key").HasMaxLength(128);
        builder.Property(x => x.AllocationKeySelector).HasColumnName("allocation_key_selector").HasMaxLength(256);
        builder.Property(x => x.SliceStart).HasColumnName("slice_start");
        builder.Property(x => x.SliceEnd).HasColumnName("slice_end");
        builder.Property(x => x.AllocationPlan).HasColumnName("allocation_plan");
        builder.Property(x => x.AssignmentUnitSelector).HasColumnName("assignment_unit_selector").HasMaxLength(256);
        builder.Property(x => x.LayerTrafficPercent).HasColumnName("layer_traffic_percent");
        builder.Property(x => x.AnalysisSamplingPlan).HasColumnName("analysis_sampling_plan");
        builder.Property(x => x.DataSourceMode).HasColumnName("data_source_mode").HasMaxLength(64);
        builder.Property(x => x.CustomerEndpointConfig).HasColumnName("customer_endpoint_config");

        builder.Ignore(x => x.Experiment);
    }
}
