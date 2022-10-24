namespace Domain.ExperimentMetrics;

public enum CustomEventTrackOption
{
    Undefined = 0,
    Conversion = 1,
    Numeric = 2
}

public enum CustomEventSuccessCriteria
{
    Undefined = 0,
    Higher = 1,
    Lower = 2
}

public enum EventType
{
    Custom = 1,
    PageView = 2,
    Click = 3
}

public enum UrlMatchType
{
    Substring = 1
}