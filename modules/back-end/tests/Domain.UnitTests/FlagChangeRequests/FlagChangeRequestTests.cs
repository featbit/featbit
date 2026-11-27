using Domain.FlagChangeRequests;

namespace Domain.UnitTests.FlagChangeRequests;

public class FlagChangeRequestTests
{
    [Theory]
    [InlineData(FlagChangeRequestStatus.Approved)]
    [InlineData(FlagChangeRequestStatus.Declined)]
    [InlineData(FlagChangeRequestStatus.Applied)]
    public void CanReview_DecidedRequest_ReturnsFalse(string status)
    {
        var reviewer = Guid.NewGuid();
        var request = NewRequest(reviewer, status);

        Assert.False(request.CanBeApprovedBy(reviewer));
        Assert.False(request.CanBeDeclinedBy(reviewer));
    }

    [Theory]
    [InlineData(FlagChangeRequestStatus.Approved, true)]
    [InlineData(FlagChangeRequestStatus.Declined, true)]
    [InlineData(FlagChangeRequestStatus.Applied, true)]
    [InlineData(FlagChangeRequestStatus.Approved, false)]
    [InlineData(FlagChangeRequestStatus.Declined, false)]
    [InlineData(FlagChangeRequestStatus.Applied, false)]
    public void Review_DecidedRequest_CannotReopenIt(string status, bool approve)
    {
        var reviewer = Guid.NewGuid();
        var request = NewRequest(reviewer, status);

        Assert.Throws<InvalidOperationException>(() =>
        {
            if (approve) request.Approve(reviewer);
            else request.Decline(reviewer);
        });

        Assert.Equal(status, request.Status);
    }

    private static FlagChangeRequest NewRequest(Guid reviewer, string status) =>
        new(Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), Guid.NewGuid(), [reviewer], Guid.NewGuid(), status: status);
}
