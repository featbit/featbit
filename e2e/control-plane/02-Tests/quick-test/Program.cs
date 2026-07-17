using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

// setup sdk options
var options = new FbOptionsBuilder("n0_d4UoepUq05K5rxeeE8wewodPbUp6k-uQvnG3YZTzA")
    .Event(new Uri("http://featbit-eval.local"))
    .Streaming(new Uri("ws://featbit-eval.local"))
    .Build();

// creates a new client instance that connects to FeatBit with the custom option.
var client = new FbClient(options);
if (!client.Initialized)
{
    Console.WriteLine(
        "FbClient failed to initialize. All Variation calls will use fallback value."
    );
}
else
{
    Console.WriteLine("FbClient successfully initialized!");
}

// flag to be evaluated
const string flagKey = "test-active-1";

// create a user
var user = FbUser.Builder("tester-id").Name("tester").Build();

// evaluate a boolean flag for a given user
var boolVariation = client.BoolVariation(flagKey, user, defaultValue: false);
Console.WriteLine($"flag '{flagKey}' returns {boolVariation} for user {user.Key}");

// evaluate a boolean flag for a given user with evaluation detail
var boolVariationDetail = client.BoolVariationDetail(flagKey, user, defaultValue: false);
Console.WriteLine(
    $"flag '{flagKey}' returns {boolVariationDetail.Value} for user {user.Key}. " +
    $"Reason Kind: {boolVariationDetail.Kind}, Reason Description: {boolVariationDetail.Reason}"
);

// close the client to ensure that all insights are sent out before the app exits
await client.CloseAsync();
