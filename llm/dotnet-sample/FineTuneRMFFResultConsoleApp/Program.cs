using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

var options = new FbOptionsBuilder().Offline(true).Build();
var client = new FbClient(options);

if (!client.Initialized) Console.WriteLine("FbClient failed to initialize. Exiting...");
else
{
    var user = FbUser.Builder("anonymous").Build();

    Console.Write("ff-key-1: true");

    var ff2 = client.StringVariation("ff-key-2", user, defaultValue: "on");
    if (ff2 == "on")
    {
        Console.WriteLine("ff-key-2:on");
    }
}



    Console.Write("fk3:t");