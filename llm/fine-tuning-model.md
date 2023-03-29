## Training Model Start

-------------------

Prompt 1:

Remove all feature flags with key `f1` and `true` return value in the following Csharp code:

```csharp
var o = new FbOptionsBuilder().Offline(true).Build();
var c = new FbClient(o);
var u = FbUser.Builder("anonymous").Build();

var f1 = c.BoolVariation("f1", u, defaultValue: false);
if (f1 == true)
{
    var b = c.StringVariation("f2", u, defaultValue: "on");
    if (b == "on")
    {
        r1(); 
        r2();
    }
}
else
    r1();

var f2 = c.StringVariation("f2", u, defaultValue: "t");
if (f2 == "t")
    r2();

void r1() { Console.WriteLine("R1"); }
void r2() { Console.WriteLine("R2"); }
```

Completion 1:

```csharp
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

var o = new FbOptionsBuilder().Offline(true).Build();
var c = new FbClient(o);
var u = FbUser.Builder("anonymous").Build();

var b = c.StringVariation("f2", u, defaultValue: "on");
if (b == "on")
{
    r1();
    r2();
}

var f2 = c.StringVariation("f2", u, defaultValue: "t");
if (f2 == "t")
    r2();

void r1() { Console.WriteLine("R1"); }
void r2() { Console.WriteLine("R2"); }
```

-------------------

Prompt 2:

Remove all feature flags with key `f1` and `false` return value in the following Csharp code:

```csharp
var o = new FbOptionsBuilder().Offline(true).Build();
var c = new FbClient(o);
var u = FbUser.Builder("anonymous").Build();

var f1 = c.BoolVariation("f1", u, defaultValue: false);
if (f1 == true)
{
    var b = c.StringVariation("f2", u, defaultValue: "on");
    if (b == "on")
    {
        r1(); 
        r2();
    }
}
else
    r1();

var f2 = c.StringVariation("f2", u, defaultValue: "t");
if (f2 == "t")
    r2();

void r1() { Console.WriteLine("R1"); }
void r2() { Console.WriteLine("R2"); }
```

Completion 2:

```csharp
using FeatBit.Sdk.Server;
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
```

-------------------

## Training Model End