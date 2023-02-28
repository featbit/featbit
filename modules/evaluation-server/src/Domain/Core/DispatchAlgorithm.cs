using System.Security.Cryptography;
using System.Text;

namespace Domain.Core;

public static class DispatchAlgorithm
{
    public static bool IsInRollout(string key, double[] rollouts)
    {
        var min = rollouts[0];
        var max = rollouts[1];

        // if [0, 1]
        if (min == 0d && 1d - max < 1e-5)
        {
            return true;
        }

        // if [0, 0]
        if (min == 0d && max == 0d)
        {
            return false;
        }

        var rollout = RolloutOfKey(key);
        return rollout >= min && rollout <= max;
    }

    public static double RolloutOfKey(string key)
    {
        var hashedKey = MD5.HashData(Encoding.UTF8.GetBytes(key));
        var magicNumber = BitConverter.ToInt32(hashedKey, 0);
        var percentage = Math.Abs((double)magicNumber / int.MinValue);

        return percentage;
    }
}