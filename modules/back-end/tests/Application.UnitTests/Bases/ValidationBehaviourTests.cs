using Application.Bases;
using Application.Bases.Behaviours;
using FluentValidation;
using FluentValidation.Results;
using Mediator;
using Moq;

namespace Application.UnitTests.Bases;

public class ValidationBehaviourTests
{
    public class Request : IRequest<string>
    {
        public string Name { get; set; } = string.Empty;
    }

    private static ValidationBehaviour<Request, string> CreateBehaviour(params IValidator<Request>[] validators)
        => new(validators);

    private static MessageHandlerDelegate<Request, string> NextWithResult(string result)
        => (_, _) => ValueTask.FromResult(result);

    [Fact]
    public async Task Handle_NoValidators_InvokesNextAndReturnsResult()
    {
        var sut = CreateBehaviour();
        var nextInvoked = false;
        MessageHandlerDelegate<Request, string> next = (_, _) =>
        {
            nextInvoked = true;
            return ValueTask.FromResult("ok");
        };

        var result = await sut.Handle(new Request(), next, CancellationToken.None);

        Assert.True(nextInvoked);
        Assert.Equal("ok", result);
    }

    [Fact]
    public async Task Handle_AllValidatorsPass_InvokesNextAndReturnsResult()
    {
        var validator = new Mock<IValidator<Request>>();
        validator
            .Setup(v => v.Validate(It.IsAny<ValidationContext<Request>>()))
            .Returns(new ValidationResult());

        var sut = CreateBehaviour(validator.Object);

        var result = await sut.Handle(new Request(), NextWithResult("done"), CancellationToken.None);

        Assert.Equal("done", result);
    }

    [Fact]
    public async Task Handle_AnyValidatorFails_ThrowsValidationExceptionAndSkipsNext()
    {
        var failure = new ValidationFailure("Name", "Name is required") { ErrorCode = "name_is_required" };
        var failing = new Mock<IValidator<Request>>();
        failing
            .Setup(v => v.Validate(It.IsAny<ValidationContext<Request>>()))
            .Returns(new ValidationResult(new[] { failure }));

        var passing = new Mock<IValidator<Request>>();
        passing
            .Setup(v => v.Validate(It.IsAny<ValidationContext<Request>>()))
            .Returns(new ValidationResult());

        var sut = CreateBehaviour(failing.Object, passing.Object);

        var nextInvoked = false;
        MessageHandlerDelegate<Request, string> next = (_, _) =>
        {
            nextInvoked = true;
            return ValueTask.FromResult("nope");
        };

        var ex = await Assert.ThrowsAsync<ValidationException>(
            async () => await sut.Handle(new Request(), next, CancellationToken.None).AsTask());

        Assert.False(nextInvoked);
        Assert.Contains(ex.Errors, e => e.ErrorCode == "name_is_required");
    }

    [Fact]
    public async Task Handle_MultipleFailingValidators_CollectsAllFailures()
    {
        var v1 = new Mock<IValidator<Request>>();
        v1.Setup(v => v.Validate(It.IsAny<ValidationContext<Request>>()))
            .Returns(new ValidationResult(new[] { new ValidationFailure("A", "a") }));

        var v2 = new Mock<IValidator<Request>>();
        v2.Setup(v => v.Validate(It.IsAny<ValidationContext<Request>>()))
            .Returns(new ValidationResult(new[] { new ValidationFailure("B", "b") }));

        var sut = CreateBehaviour(v1.Object, v2.Object);

        var ex = await Assert.ThrowsAsync<ValidationException>(
            async () => await sut.Handle(new Request(), NextWithResult("x"), CancellationToken.None).AsTask());

        Assert.Equal(2, ex.Errors.Count());
    }
}
