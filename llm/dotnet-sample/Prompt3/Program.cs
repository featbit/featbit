#if true 
// In the given code, eliminate the feature flags tied to the key `f-f-1`, while preserving the code associated with the `false` return value. Also, maintain any other code not related to these feature flags. Ignore the defaultValue. Provide just the code, excluding any descriptions.
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

        var f1 = c.BoolVariation("f-f-1", u, defaultValue: false);
        if (f1 == true)
        {
            F.R1();
        }
        else
            F.RNN1();

        if (f1)
        {
            F.R1();
        }
        else
            F.RNN2();


        if (f1 == false || !f1)
        {
            return F.RNN();
        }

        return F.R1(); 
    }
}
public class F
{
    public static bool RNN() { return false; }
    public static void RNN1() { }
    public static void RNN2() { }
    public static bool R1() { return true; }
}

#else
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;
using System.Net;

var o = new FbOptionsBuilder().Offline(true).Build();
var c = new FbClient(o);
(new Pmpt()).P(c);

public class Pmpt
{
    public bool P(FbClient c)
    {
        F.RNN1();
        F.RNN2();
        return F.RNN();
    }
}
public class F
{
    public static bool RNN() { return false; }
    public static void RNN1() { }
    public static void RNN2() { }
    public static bool R1() { return true; }
}
#endif