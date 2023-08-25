using Application.Bases;
using Domain.AuditLogs;
using Domain.Segments;
using Domain.SemanticPatch;

namespace Application.AuditLogs;

public class CompareSegment : IRequest<IEnumerable<Instruction>>
{
    public Segment Previous { get; set; }
    
    public Segment Current { get; set; }
}

public class CompareSegmentValidator : AbstractValidator<CompareSegment>
{
    public CompareSegmentValidator()
    {
        RuleFor(x => x.Previous)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.InvalidPreviousValue);
        
        RuleFor(x => x.Current)
            .NotEmpty()
            .WithErrorCode(ErrorCodes.InvalidCurrentValue);
    }
}

public class CompareHandler : IRequestHandler<CompareSegment, IEnumerable<Instruction>>
{
    public async Task<IEnumerable<Instruction>> Handle(CompareSegment request, CancellationToken cancellationToken)
    {
        var dateChange = new DataChange(request.Previous);
        dateChange.To(request.Current);
        
        var previous = dateChange.DeserializePrevious<Segment>();
        var current = dateChange.DeserializeCurrent<Segment>();
        var instructions = SegmentComparer.Compare(previous, current);

        return instructions;
    }
}