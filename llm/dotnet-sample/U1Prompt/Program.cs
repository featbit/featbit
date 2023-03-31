using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

//  In the given code, eliminate the feature flags tied to the key `ui-c`, while preserving the code associated with the `true` return value. Also, maintain any other code not related to these feature flags. Ignore the defaultValue.
var o = new FbOptionsBuilder().Offline(true).Build();
var c = new FbClient(o);

(new UProm()).UP(c);


public class UProm
{
    public string UP(FbClient c)
    {
        var user = FbUser.Builder("usage").Name("usage").Build();
        string total = "0", num1 = "3", num2 = "12";
        var ifC = c.BoolVariation("ui-c", user, defaultValue: false);
        if (ifC == true)
        {
            return total + num1 + num2;
        }
        return total;
    }
}