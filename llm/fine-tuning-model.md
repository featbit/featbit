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

Prompt 3:

Remove all feature flags with key "featureC" and false value in the following Csharp code:

```csharp
var z = client.BoolVariation("featureC", u, defaultValue: false);
if (z == true)
{
    r5();
}
if (z == false)
{
    r6();
}

void r5() { Console.WriteLine("R5"); }
void r6() { Console.WriteLine("R6"); }
```

Completion 3:

```csharp
r5();

void r5() { Console.WriteLine("R5"); }
void r6() { Console.WriteLine("R6"); }
```

-------------------

Prompt 4:

Remove all feature flags with key "featureD" and true value in the following Csharp code:

```csharp
var k = client.StringVariation("featureD", u, defaultValue: "yes");
if (k == "yes")
{
    r7();
}
else
{
    r8();
}

void r7() { Console.WriteLine("R7"); }
void r8() { Console.WriteLine("R8"); }
```

Completion 4:

```csharp
r8();

void r7() { Console.WriteLine("R7"); }
void r8() { Console.WriteLine("R8"); }
```

-------------------

Prompt 5:

Remove all feature flags with key "featureE" and false value in the following Csharp code:

```csharp
var m = client.BoolVariation("featureE", u, defaultValue: false);
if (m == true)
{
    r9();
}
if (m == false)
{
    r10();
}

void r9() { Console.WriteLine("R9"); }
void r10() { Console.WriteLine("R10"); }
```

Completion 5:

```csharp
r9();

void r9() { Console.WriteLine("R9"); }
void r10() { Console.WriteLine("R10"); }
```

## Training Model End