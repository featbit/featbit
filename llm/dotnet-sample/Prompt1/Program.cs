#if true 
// In the given code, eliminate the feature flags tied to the key `f1k`, while preserving the code associated with the `true` return value. Also, maintain any other code not related to these feature flags. Ignore the defaultValue. Provide just the code, excluding any descriptions.
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

(new Pmpt()).P();

public class Pmpt
{
    public void P()
    {
        var o = new FbOptionsBuilder().Offline(true).Build();
        var c = new FbClient(o);
        var u = FbUser.Builder("anonymous").Build();

        var f1 = c.BoolVariation("f1k", u, defaultValue: false);
        if (f1 == true)
        {
            var b = c.StringVariation("f2", u, defaultValue: "on");
            if (b == "on")
            {
                F.R1();
                F.R2();
            }
        }
        else if (f1 == false)
            F.RN();
        else
            F.RN();
    }
}

public class F
{
    public static void RN() { }
    public static void R1() { }
    public static void R2() { }
}


#else // completion codes
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

//  Remove all feature flags with key `f1k` and doesn't return `true` value in following code
(new Pmpt()).P();

public class Pmpt
{
    public void P()
    {
        var o = new FbOptionsBuilder().Offline(true).Build();
        var c = new FbClient(o);
        var u = FbUser.Builder("anonymous").Build();

        var b = c.StringVariation("f2", u, defaultValue: "on");
        if (b == "on")
        {
            F.R1();
            F.R2();
        }
    }
}

public class F
{
    public static void RN() { }
    public static void R1() { }
    public static void R2() { }
}

#endif