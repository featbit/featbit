using Application.Bases.Models;

namespace Application.Experiments.ExperimentLayers;

public class ExperimentLayerFilter : PagedRequest
{
    public string SearchText { get; set; }

    public string Name { get; set; }

    public string Key { get; set; }

    public string Status { get; set; }
}
