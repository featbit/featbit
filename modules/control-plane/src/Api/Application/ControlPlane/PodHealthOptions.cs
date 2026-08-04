namespace Api.Application.ControlPlane;

public class PodHealthOptions
{
    public const string SectionName = "PodHealth";

    public bool Enabled { get; set; }

    public int TimeoutInSeconds { get; set; } = 90;

    public int CheckIntervalInSeconds { get; set; } = 90;
}
