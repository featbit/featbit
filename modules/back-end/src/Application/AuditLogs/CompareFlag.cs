using Application.Bases;
using Domain.AuditLogs;
using Domain.FeatureFlags;
using Domain.Segments;
using Domain.SemanticPatch;

namespace Application.AuditLogs;

public class CompareFlag : IRequest<IEnumerable<Instruction>>
{
    public Segment Previous { get; set; }
    
    public Segment Current { get; set; }
}

public class CompareFlagValidator : AbstractValidator<CompareFlag>
{
    public CompareFlagValidator()
    {
        RuleFor(x => x.Previous)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.InvalidPreviousValue);
        
        RuleFor(x => x.Current)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.InvalidCurrentValue);
    }
}

public class CompareFlagHandler : IRequestHandler<CompareFlag, IEnumerable<Instruction>>
{
    public async Task<IEnumerable<Instruction>> Handle(CompareFlag request, CancellationToken cancellationToken)
    {
        var dateChange = new DataChange(request.Previous);
        dateChange.To(request.Current);
        
        var previous = dateChange.DeserializePrevious<FeatureFlag>();
        var current = dateChange.DeserializeCurrent<FeatureFlag>();
        var instructions = FlagComparer.Compare(previous, current);

        return instructions;
    }
}