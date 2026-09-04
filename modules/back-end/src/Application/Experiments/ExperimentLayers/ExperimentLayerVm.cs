namespace Application.Experiments.ExperimentLayers;

public class ExperimentLayerVm
{
    public Guid Id { get; set; }

    public Guid FeatBitEnvId { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string Description { get; set; }

    public string AssignmentUnitSelector { get; set; }

    public string Status { get; set; }

    public DateTime CreatedAt { get; set; }

    public DateTime UpdatedAt { get; set; }

    public ICollection<ExperimentLayerRunVm> ExperimentRuns { get; set; }

    public ExperimentLayerAllocationVm AllocationSummary { get; set; }
}

public class ExperimentLayerRunVm
{
    public Guid Id { get; set; }

    public Guid ExperimentId { get; set; }

    public string ExperimentName { get; set; }

    public string Key { get; set; }

    public Guid? LayerId { get; set; }

    public string LayerKey { get; set; }

    public string AssignmentUnitSelector { get; set; }

    public double Start { get; set; }

    public double End { get; set; }

    public string Status { get; set; }

    public bool IncludedInAllocation { get; set; }
}

public class ExperimentLayerOverlapVm
{
    public double Start { get; set; }

    public double End { get; set; }

    public ICollection<Guid> RunIds { get; set; } = [];
}

public class ExperimentLayerAllocationVm
{
    public int ActiveRunCount { get; set; }

    public double ReservedPercent { get; set; }

    public double FreePercent { get; set; }

    public ICollection<ExperimentLayerOverlapVm> Overlaps { get; set; } = [];

    public bool MixedAssignmentUnits { get; set; }

    public bool OverAllocated { get; set; }

    public string Status { get; set; }
}
