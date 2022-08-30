using BenchmarkDotNet.Attributes;
using BenchmarkDotNet.Order;

namespace Benchmarks;

[MemoryDiagnoser]
[Orderer(SummaryOrderPolicy.FastestToSlowest)]
public class TokenNumberBenchmarks
{
    private static readonly Dictionary<char, char> CharacterMap = new()
    {
        { 'Q', '0' },
        { 'B', '1' },
        { 'W', '2' },
        { 'S', '3' },
        { 'P', '4' },
        { 'H', '5' },
        { 'D', '6' },
        { 'X', '7' },
        { 'Z', '8' },
        { 'U', '9' },
    };

    private const string Characters = "BDDBXZPZPXSDQ";

    [Benchmark]
    public long HeapAlloc_Decode_Long()
    {
        if (string.IsNullOrWhiteSpace(Characters))
        {
            return 0L;
        }

        var number = new char[Characters.Length];
        for (var i = 0; i < Characters.Length; i++)
        {
            number[i] = CharacterMap[Characters[i]];
        }

        return long.Parse(number);
    }
    
    [Benchmark]
    public long StackAlloc_Decode_Long()
    {
        if (string.IsNullOrWhiteSpace(Characters))
        {
            return 0L;
        }

        Span<char> chars = stackalloc char[Characters.Length];
        for (var i = 0; i < chars.Length; i++)
        {
            chars[i] = CharacterMap[Characters[i]];
        }

        return long.Parse(chars);
    }
}