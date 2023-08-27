using Application.Bases;
using Domain.AuditLogs;
using Domain.SemanticPatch;

namespace Application.AuditLogs;

public class Compare : IRequest<IEnumerable<Instruction>>
{
    public string RefType { get; set; }

    public DataChange DataChange { get; set; }
}

public class CompareValidator : AbstractValidator<Compare>
{
    public CompareValidator()
    {
        RuleFor(x => x.RefType)
            .Must(AuditLogRefTypes.IsDefined)
            .WithErrorCode(ErrorCodes.Invalid("RefType"));

        RuleFor(x => x.DataChange)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Invalid("DataChange"));

        RuleFor(x => x.DataChange.Previous)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Invalid("DataChange.Previous"));

        RuleFor(x => x.DataChange.Current)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.Invalid("DataChange.Current"));
    }
}

public class CompareHandler : IRequestHandler<Compare, IEnumerable<Instruction>>
{
    public Task<IEnumerable<Instruction>> Handle(Compare request, CancellationToken cancellationToken)
    {
        var instructions = GetInstructions();
        return Task.FromResult(instructions);

        IEnumerable<Instruction> GetInstructions()
        {
            return request.RefType switch
            {
                AuditLogRefTypes.FeatureFlag => FlagComparer.Compare(request.DataChange),
                AuditLogRefTypes.Segment => SegmentComparer.Compare(request.DataChange),
                _ => Array.Empty<Instruction>()
            };
        }
    }
}