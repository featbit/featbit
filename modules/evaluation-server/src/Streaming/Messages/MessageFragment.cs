using System.Buffers;

namespace Streaming.Messages;

public class MessageFragments
{
    private readonly List<MessageFragment> _fragments;

    public MessageFragments()
    {
        _fragments = new List<MessageFragment>();
    }

    public int Count => _fragments.Count;

    public void Free(bool clearRentedArray = false)
    {
        for (var i = 0; i < _fragments.Count; i++)
        {
            _fragments[i].Free(clearRentedArray);
        }

        _fragments.Clear();
    }

    public void Append(byte[] buffer, int length)
    {
        var fragment = new MessageFragment(buffer, length);

        _fragments.Add(fragment);
    }

    public byte[] GetBytes()
    {
        var length = _fragments.Sum(x => x.Length);
        var bytes = new byte[length];
        var srcOffset = 0;

        for (var i = 0; i < _fragments.Count; i++)
        {
            var fragment = _fragments[i];
            Buffer.BlockCopy(fragment.Bytes, 0, bytes, srcOffset, fragment.Length);

            srcOffset += fragment.Length;
        }

        return bytes;
    }
}

public struct MessageFragment
{
    public byte[] Bytes { get; }

    public int Length { get; }

    public MessageFragment(byte[] buffer, int length)
    {
        Bytes = ArrayPool<byte>.Shared.Rent(length);
        Length = length;

        Buffer.BlockCopy(buffer, 0, Bytes, 0, length);
    }

    public void Free(bool clearRentedArray = false)
    {
        ArrayPool<byte>.Shared.Return(Bytes, clearRentedArray);
    }
}