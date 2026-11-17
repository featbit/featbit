using Domain.Experiments;

namespace Application.Experiments;

public class ExperimentListStateSummaryVm
{
    public bool HasLearning { get; set; }

    public ICollection<ExperimentRunStateSummaryVm> Runs { get; set; } = [];

    public static ExperimentListStateSummaryVm From(string lastLearning, IEnumerable<ExperimentRun> runs) => new()
    {
        HasLearning = !string.IsNullOrWhiteSpace(lastLearning),
        Runs = runs.Select(run => new ExperimentRunStateSummaryVm
        {
            Id = run.Id,
            CreatedAt = run.CreatedAt,
            ObservationStart = run.ObservationStart,
            ObservationEnd = run.ObservationEnd,
            Decision = run.Decision,
            HasLearning = !string.IsNullOrWhiteSpace(run.WhatChanged)
                || !string.IsNullOrWhiteSpace(run.WhatHappened)
                || !string.IsNullOrWhiteSpace(run.ConfirmedOrRefuted)
                || !string.IsNullOrWhiteSpace(run.WhyItHappened)
                || !string.IsNullOrWhiteSpace(run.NextHypothesis)
        }).ToArray()
    };
}

public class ExperimentRunStateSummaryVm
{
    public Guid Id { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime? ObservationStart { get; set; }

    public DateTime? ObservationEnd { get; set; }

    public string Decision { get; set; }

    public bool HasLearning { get; set; }
}
