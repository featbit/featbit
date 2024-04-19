namespace Domain.EndUsers;

public class ImportUserResult
{
    /// <summary>
    /// Gets a value indicating whether the operation was acknowledged.
    /// </summary>
    public bool IsAcknowledged { get; set; }

    /// <summary>
    /// Gets the number of users that were inserted.
    /// </summary>
    public long InsertedCount { get; set; }

    /// <summary>
    /// Gets the number of users that were actually modified during an update.
    /// </summary>
    public long ModifiedCount { get; set; }

    public static ImportUserResult Ok(long insertedCount, long modifiedCount)
    {
        return new ImportUserResult
        {
            IsAcknowledged = true,
            InsertedCount = insertedCount,
            ModifiedCount = modifiedCount
        };
    }

    public static ImportUserResult Fail()
    {
        return new ImportUserResult
        {
            IsAcknowledged = false,
            InsertedCount = 0,
            ModifiedCount = 0
        };
    }
}