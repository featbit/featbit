using System.Buffers;
using System.Text;

namespace Domain;

public struct Secret
{
    public int AccountId { get; set; }

    public int ProjectId { get; set; }

    public int EnvId { get; set; }

    public static bool TryParse(string secretString, out Secret secret)
    {
        secret = default;

        if (string.IsNullOrWhiteSpace(secretString))
        {
            return false;
        }

        // minimum length that is sure to fit all the data
        // We don't need to be 100% accurate here,
        // because ArrayPool might return a larger buffer anyway.
        var length = (secretString.Length / 3 + 1) * 4;
        var bytes = ArrayPool<byte>.Shared.Rent(length);

        try
        {
            var isValidBase64 = Convert.TryFromBase64String(secretString, bytes, out var bytesWritten);
            if (!isValidBase64)
            {
                return false;
            }

            // origin string format: firstPart__accountId__projectId__envId__lastPart
            var origin = Encoding.UTF8.GetString(bytes, 0, bytesWritten).AsSpan();

            Span<int> ids = stackalloc int[3];

            var startNext = 0;
            for (var i = 0; i < 4; i++)
            {
                var currentSlice = origin[startNext..];

                var separatorIndex = currentSlice.IndexOf("__");
                if (separatorIndex == -1)
                {
                    return false;
                }

                // accountId projectId envId must be a number which bigger than 0
                if (i is 1 or 2 or 3)
                {
                    var part = currentSlice[..separatorIndex];
                    if (!int.TryParse(part, out ids[i - 1]) || ids[i - 1] <= 0)
                    {
                        return false;
                    }
                }

                startNext += 2 + separatorIndex;
            }

            secret = new Secret
            {
                AccountId = ids[0],
                ProjectId = ids[1],
                EnvId = ids[2],
            };
            return true;
        }
        finally
        {
            ArrayPool<byte>.Shared.Return(bytes);
        }
    }
}