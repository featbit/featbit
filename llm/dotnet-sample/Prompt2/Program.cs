#if true 
// In the given code, eliminate the feature flags tied to the key `f2k`, while preserving the code associated with the `on` return value. Also, maintain any other code not related to these feature flags. Ignore the defaultValue. Provide just the code, excluding any descriptions.
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

//  Remove all feature flags with key `f2k` and doesn't return `on` value in following code
var o = new FbOptionsBuilder().Offline(true).Build();
var c = new FbClient(o);
(new Pmpt()).P(c);

public class Pmpt
{
    public void P(FbClient c)
    {
        var u = FbUser.Builder("anonymous").Build();

        var f1 = c.BoolVariation("f1", u, defaultValue: false);
        if (f1 == true)
        {
            F.R1();
            var b = c.StringVariation("f2k", u, defaultValue: "on");
            if (b == "on")
            {
                F.RR2();
            }
        }
        else
            F.R1();

        var f2 = c.StringVariation("f2k", u, defaultValue: "on");
        if (f2 == "t")
            F.RN3();
        else if (f2 == "on")
            F.R2();
        else
            F.R1();
    }
}
public class F
{
    public static void RN3() { }
    public static void R1() { }
    public static void RR2() { }
    public static void R2() { }
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
    public void P(FbClient c)
    {
        var u = FbUser.Builder("anonymous").Build();

        var f1 = c.BoolVariation("f1", u, defaultValue: false);
        if (f1 == true)
        {
            F.R1();
            F.RR2();
        }
        else
            F.R1();

        F.R2();
    }
}
public class F
{
    public static void RN3() { }
    public static void R1() { }
    public static void RR2() { }
    public static void R2() { }
}
#endif