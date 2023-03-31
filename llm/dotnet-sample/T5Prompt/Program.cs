#if true 
// In the given code, eliminate the feature flags tied to the key `ifC`, while preserving the code associated with the `true` return value. Also, maintain any other code not related to these feature flags. Ignore the defaultValue. Provide just the code, excluding any descriptions.
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

var o = new FbOptionsBuilder().Offline(true).Build();
var c = new FbClient(o);
var u = FbUser.Builder("usage").Name("usage").Build();

(new UProm()).UP(c, u);


public class UProm
{
    public string UP(FbClient c, FbUser user)
    {
        string total = "0", num1 = "3", num2 = "12";
        var ifC = c.BoolVariation("ifC", user, defaultValue: false);
        if (ifC == true)
        {
            return total + num1 + num2;
        }
        return total;
    }
}


#else // completion codes
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;
using System.Net;

var o = new FbOptionsBuilder().Offline(true).Build();
var c = new FbClient(o);
var u = FbUser.Builder("usage").Name("usage").Build();

(new UProm()).UP(c, u);

public class UProm
{
    public string UP(FbClient c, FbUser user)
    {
        string total = "0", num1 = "3", num2 = "12";
        return total + num1 + num2;
    }
}
#endif