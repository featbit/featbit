using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;


(new RunCore()).Test1();

public class RunCore
{
    private readonly FbClient _c;
    private readonly FbUser _u;

    public RunCore()
    {
        var _o = new FbOptionsBuilder().Offline(true).Build();
        _c = new FbClient(_o);
        _u = FbUser.Builder("anonymous").Build();
    }

    public void Test1()
    {
        var f1 = _c.BoolVariation("f1", _u, defaultValue: false);
        var f2 = _c.IntVariation("f2", _u, defaultValue: 6);
        var f3 = _c.StringVariation("f3", _u, defaultValue: "V");
        var f = new SomeFunctions(f1, f2, f3);
        f.R1();
        f.R2();
        f.R3();
    }
}

public class SomeFunctions
{
    private readonly bool _f1;
    private readonly int _f2;
    public SomeFunctions(bool f1, int f2)
    {
        _f1 = f1;
        _f2 = f2;
    }

    public bool R1()
    {
        if (_f1 == true)
        {
            return true;
        }
        else
            return false;
    }

    public int R2()
    {
        if (_f2 > 3)
        {
            return _f2;
        }
        else
            return 0;
    }

    public string R3(string f3)
    {
        if (f3 == "V")
        {
            return f3;
        }
        else
            return "";
    }
}