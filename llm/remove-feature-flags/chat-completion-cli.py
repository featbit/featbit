import openai
import argparse


def main(apikey: str, code: str, ffKey: str, variation: str) -> None:
    openai.api_key = "" + apikey
    prompt = (
        "```csharp "
        + code
        + "``` In the given code, eliminate the feature flags tied to the key `"
        + ffKey
        + "`, while preserving the code associated with the `"
        + variation
        + "` return value. Also, maintain any other code not related to these feature flags. Ignore the defaultValue. Provide just the code, excluding any descriptions."
    )

    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo-0301",
        temperature=0,
        messages=[
            {
                "role": "system",
                "content": "Remove useless and expired feature flags in code.",
            },
            {
                "role": "user",
                "content": "Hello Assistant, as a developer, I need your assistance in cleaning up the code by removing unnecessary and expired feature flags. Please also help me maintain the relevant business logic that is directly or indirectly wrapped within these feature flags.",
            },
            {
                "role": "user",
                "content": '```csharp using FeatBit.Sdk.Server;using FeatBit.Sdk.Server.Model;using FeatBit.Sdk.Server.Options;(new Pmpt()).P(); public class Pmpt{public void P(){var o=new FbOptionsBuilder().Offline(true).Build();var c=new FbClient(o);var u=FbUser.Builder("anonymous").Build();var f1=c.BoolVariation("f1k",u,defaultValue:false);if(f1==true){var b=c.StringVariation("f2",u,defaultValue:"on");if(b=="on"){F.R1();F.R2();}}else if(f1==false)F.RN();else F.RN();}}``` In the given code, eliminate the feature flags tied to the key `f1k`, while preserving the code associated with the `true` return value. Also, maintain any other code not related to these feature flags. Ignore the defaultValue. Provide just the code, excluding any descriptions.',
            },
            {
                "role": "assistant",
                "content": '```csharp using FeatBit.Sdk.Server;using FeatBit.Sdk.Server.Model;using FeatBit.Sdk.Server.Options;(new Pmpt()).P(); public class Pmpt{public void P(){var o=new FbOptionsBuilder().Offline(true).Build();var c=new FbClient(o);var u=FbUser.Builder("anonymous").Build();var b=c.StringVariation("f2",u,defaultValue:"on");if(b=="on"){F.R1();F.R2();}}}```',
            },
            {
                "role": "user",
                "content": '```csharp using FeatBit.Sdk.Server;using FeatBit.Sdk.Server.Model;using FeatBit.Sdk.Server.Options;var o=new FbOptionsBuilder().Offline(true).Build();var c=new FbClient(o);(new Pmpt()).P(c); public class Pmpt{public void P(FbClient c){var u=FbUser.Builder("anonymous").Build();var f1=c.BoolVariation("f1",u,defaultValue:false);if(f1==true){F.R1();var b=c.StringVariation("f2k",u,defaultValue:"on");if(b=="on"){F.RR2();}}else F.R1();var f2=c.StringVariation("f2k",u,defaultValue:"on");if(f2=="t")F.RN3();else if(f2=="on")F.R2();else F.R1();}}``` In the given code, eliminate the feature flags tied to the key `f2k`, while preserving the code associated with the `on` return value. Also, maintain any other code not related to these feature flags. Ignore the defaultValue. Provide just the code, excluding any descriptions.',
            },
            {
                "role": "assistant",
                "content": '```csharp using FeatBit.Sdk.Server;using FeatBit.Sdk.Server.Model;using FeatBit.Sdk.Server.Options;var o=new FbOptionsBuilder().Offline(true).Build();var c=new FbClient(o);(new Pmpt()).P(c); public class Pmpt{public void P(FbClient c){var u=FbUser.Builder("anonymous").Build();var f1=c.BoolVariation("f1",u,defaultValue:false);if(f1==true){F.R1();F.RR2();}else F.R1();F.R2();}}```',
            },
            {
                "role": "user",
                "content": '```csharp using FeatBit.Sdk.Server;using FeatBit.Sdk.Server.Model;using FeatBit.Sdk.Server.Options;using System.Net;var option=new FbOptionsBuilder().Offline(true).Build();var client=new FbClient(option);(new Pmpt()).P(client); public class Pmpt{public bool P(FbClient c){var u=FbUser.Builder("anonymous").Build();var f1=c.BoolVariation("f-f-1",u,defaultValue:false);if(f1==true){F.R1();}else F.RNN1();if(f1){F.R1();}else F.RNN2();if(f1==false||!f1){return F.RNN();}return F.R1();}}``` In the given code, eliminate the feature flags tied to the key `f-f-1`, while preserving the code associated with the `false` return value. Also, maintain any other code not related to these feature flags. Ignore the defaultValue. Provide just the code, excluding any descriptions.',
            },
            {
                "role": "assistant",
                "content": "```csharp using FeatBit.Sdk.Server;using FeatBit.Sdk.Server.Model;using FeatBit.Sdk.Server.Options;using System.Net;var option=new FbOptionsBuilder().Offline(true).Build();var client=new FbClient(option);(new Pmpt()).P(client); public class Pmpt{public bool P(FbClient c){F.RNN1();F.RNN2();return F.RNN();}}```",
            },
            {
                "role": "user",
                "content": '```csharp using FeatBit.Sdk.Server;using FeatBit.Sdk.Server.Model;using Microsoft.AspNetCore.Mvc;namespace T4Prompt.Controllers; [ApiController][Route("[controller]")]public class HelloController:ControllerBase{private readonly FbClient _client;public HelloController(FbClient client){_client=client;}[HttpGet]public string HelloWorld(){var u=FbUser.Builder("bob").Name("bob").Build();var variation=_client.StringVariation("language",u,"en-us");return variation switch{"zh-cn"=>"你好世界！","en-us"=>"Hello World!",_=>string.Empty};}}``` In the given code, eliminate the feature flags tied to the key `language`, while preserving the code associated with the `zh-cn` return value. Also, maintain any other code not related to these feature flags. Ignore the defaultValue. Provide just the code, excluding any descriptions.',
            },
            {
                "role": "assistant",
                "content": '```csharp using FeatBit.Sdk.Server;using FeatBit.Sdk.Server.Model;using Microsoft.AspNetCore.Mvc;namespace T4Prompt.Controllers; [ApiController][Route("[controller]")]public class HelloController:ControllerBase{private readonly FbClient _client;public HelloController(FbClient client){_client=client;}[HttpGet]public string HelloWorld(){return"你好世界！";}}```',
            },
            {
                "role": "user",
                "content": '```csharp public class UProm{public string UP(FbClient c,FbUser user){string total="0",num1="3",num2="12";var ifC=c.BoolVariation("ifC",user,defaultValue:false);if(ifC==true){return total+num1+num2;}return total;}}``` In the given code, eliminate the feature flags tied to the key `ifC`, while preserving the code associated with the `true` return value. Also, maintain any other code not related to these feature flags. Ignore the defaultValue. Provide just the code, excluding any descriptions.',
            },
            {
                "role": "assistant",
                "content": '```csharp public class UProm{public string UP(FbClient c,FbUser user){string total="0",num1="3",num2="12";return total+num1+num2;}}```',
            },
            {
                "role": "user",
                "content": '```csharp public class Pmpt{public bool P(FbClient c){var u=FbUser.Builder("anonymous").Build();var f1=c.BoolVariation("f-f",u,defaultValue:false);if(f1==true){return F.RNN1();}return F.RNN();}}``` In the given code, eliminate the feature flags tied to the key `f-f`, while preserving the code associated with the `true` return value. Also, maintain any other code not related to these feature flags. Ignore the defaultValue. Provide just the code, excluding any descriptions.',
            },
            {
                "role": "assistant",
                "content": "```csharp public class Pmpt{public bool P(FbClient c){return F.RNN1();}}```",
            },
            {
                "role": "user",
                "content": prompt,
            },
        ],
    )

    # print(response)
    # remove ```csharp in` response.choices[0].message.content and ``` at the end of the string
    print(response.choices[0].message.content.replace("```csharp", "")[:-3])


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="")
    parser.add_argument("--apikey", required=True, help="OpenAI key.")
    parser.add_argument("--ffKey", required=True, help="Feature Flag Key.")
    parser.add_argument(
        "--variation", required=True, help="Feature Flag valid return variation."
    )
    parser.add_argument("--codePath", required=True, help="Code source path.")

    args = parser.parse_args()


    # read file and give it to a string variable
    with open(args.codePath, "r") as file:
        codeSource = file.read()

    main(args.apikey, codeSource, args.ffKey, args.variation)

