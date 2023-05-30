using Streaming.Messages;

namespace Streaming.UnitTests.Messages;

public class MessageFragmentTests
{
    [Fact]
    public void CreateMessageFragment()
    {
        const byte contentLength = 10;
        var buffer = new byte[100];
        for (byte i = 0; i < contentLength; i++)
        {
            buffer[i] = i;
        }

        var fragment = new MessageFragment(buffer, contentLength);

        Assert.Equal(contentLength, fragment.Length);
        Assert.True(fragment.Bytes.Length >= contentLength);
        
        var bytes = fragment.Bytes[..fragment.Length];
        for (byte i = 0; i < contentLength; i++)
        {
            Assert.Equal(i, bytes[i]);
        }
    }

    [Fact]
    public void GetBytesFromMessageSegments()
    {
        var fragments = new MessageFragments();

        var f1 = new byte[] { 0x0, 0x1, 0x2, 0x3, 0x0, 0x0, 0x0, 0x0, 0x0 };
        var f2 = new byte[] { 0x4, 0x5, 0x0, 0x0, 0x0, 0x0, };
        var f3 = new byte[] { 0x6, 0x7, 0x8, 0x0, 0x0, 0x0 };
        var f4 = new byte[] { 0x9, 0x0, 0x0, 0x0, 0x0 };

        fragments.Append(f1, 4);
        fragments.Append(f2, 2);
        fragments.Append(f3, 3);
        fragments.Append(f4, 1);

        Assert.Equal(4, fragments.Count);

        var bytes = fragments.GetBytes();
        Assert.Equal(10, bytes.Length);
        for (byte i = 0; i < 10; i++)
        {
            Assert.Equal(i, bytes[i]);
        }
    }

    [Fact]
    public void FreeMessageFragments()
    {
        var fragments = new MessageFragments();

        var f1 = new byte[] { 0x0, 0x1, 0x2, 0x3, 0x0, 0x0, 0x0, 0x0, 0x0 };
        var f2 = new byte[] { 0x4, 0x5, 0x0, 0x0, 0x0, 0x0 };
        
        fragments.Append(f1, 4);
        fragments.Append(f2, 2);
        
        fragments.Free(true);

        Assert.Equal(0, fragments.Count);
        
        // all fragments has been freed
        Assert.True(fragments.GetBytes().All(x => x == 0x0));
    }
}