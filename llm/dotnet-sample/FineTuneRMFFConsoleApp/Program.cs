using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

var options = new FbOptionsBuilder().Offline(true).Build();
var client = new FbClient(options);
if (!client.Initialized) Console.WriteLine("FbClient failed to initialize. Exiting...");
else
{
    var user = FbUser.Builder("anonymous").Build();

    var a = client.BoolVariation("ff-key-1", user, defaultValue: false);
    if(a == true)
        Console.Write("ff-key-1: true");

    if(a == false)
    {
        var b = client.StringVariation("ff-key-2", user, defaultValue: "on");
        if (b == "on")
        {
            Console.WriteLine("ff-key-2:on");
        }
    }
}


var o = new FbOptionsBuilder().Offline(true).Build();
var c = new FbClient(options);
var a = client.StringVariation("fk3", FbUser.Builder("anonymous").Build(), defaultValue: "t");
if (a == "t")
    Console.Write("fk3:t");