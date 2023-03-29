﻿using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

var o = new FbOptionsBuilder().Offline(true).Build();
var c = new FbClient(o);
var u = FbUser.Builder("anonymous").Build();

r1();

var f2 = c.StringVariation("f2", u, defaultValue: "t");
if (f2 == "t")
    r2();

void r1() { Console.WriteLine("R1"); }
void r2() { Console.WriteLine("R2"); }