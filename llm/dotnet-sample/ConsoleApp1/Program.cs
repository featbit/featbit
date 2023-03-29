using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

var o = new FbOptionsBuilder().Offline(true).Build();
var c = new FbClient(o);

var u = FbUser.Builder("anonymous").Build();

var a = c.BoolVariation("f01", u, defaultValue: false);
if (a == true)
    r1();






void r1() { Console.WriteLine("R1"); }
void r2() { Console.WriteLine("R2"); }
void r3() { Console.WriteLine("R3"); }
void r4() { Console.WriteLine("R4"); }
void r5() { Console.WriteLine("R5"); }