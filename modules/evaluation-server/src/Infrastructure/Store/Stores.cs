namespace Infrastructure.Store;

public static class Stores
{
    public const string None = "None";
    public const string Empty = "Empty";

    // these store names are designed to be ordered by priority, 0 is the highest priority
    public const string Redis = "0_Redis";
    public const string MongoDb = "1_MongoDb";
    public const string Postgres = "1_Postgres";
    public const string Hybrid = "2_Hybrid";
}