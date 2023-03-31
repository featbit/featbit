#if true 
// In the given code, eliminate the feature flags tied to the key `f-f`, while preserving the code associated with the `true` return value. Also, maintain any other code not related to these feature flags. Ignore the defaultValue. Provide just the code, excluding any descriptions.
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

var o = new FbOptionsBuilder().Offline(true).Build();
var c = new FbClient(o);
(new Pmpt()).P(c);

public class Pmpt
{
    public bool P(FbClient c)
    {
        var u = FbUser.Builder("anonymous").Build();
        var f1 = c.BoolVariation("f-f", u, defaultValue: false);
        if (f1 == true)
        {
            return F.RNN1();
        }

        return F.RNN();
    }
}
public class F
{
    public static bool RNN() { return false; }
    public static bool RNN1() { return true; }
}

#else
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

var o = new FbOptionsBuilder().Offline(true).Build();
var c = new FbClient(o);
(new Pmpt()).P(c);

public class Pmpt
{
    public bool P(FbClient c)
    {
        return F.RNN1();
    }
}
public class F
{
    public static bool RNN() { return false; }
    public static bool RNN1() { return true; }
}
#endif