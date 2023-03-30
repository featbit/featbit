import openai
openai.api_key = ""

prompt = "I have a piece of code. I need you to help me remove all feature flags written in the code. Here is an example. Code before clean feature flags: ```csharpint abc=0,a=3,b=4;if(featbitFlags[\"feature-flag-key\"]==true){int c=a+b;return abc+c;}return abc;``` after clean feature flags: after clean feature flags: ```csharp int abc = 0, a = 3, b = 4; int c = a + b; return abc + c;``` With example shown above, can you help me to clean feature flags in the code below? ```csharp string total = \"0\", num1 = \"3\", num2 = \"12\"; if(featbitFlags[\"feature-flag-key\"]==true){ return total + num1 + num2;} return total;```"

# prompt = "Remove all feature flag with key fk3 in following code: \r\r ```csharp  \r  var o=new FbOptionsBuilder().Offline(true).Build();var c=new FbClient(options);var a=client.StringVariation(\"fk3\",FbUser.Builder(\"anonymous\").Build(),defaultValue:\"t\");if(a==\"t\") Console.Write(\"fk3:t\");```"
model = "text-davinci-003"
# model = "gpt-3.5-turbo"

response = openai.Completion.create(
    engine=model,
    prompt=prompt,
    max_tokens=1024,
    n=1,
    stop=None,
    temperature=0.5,
)
generated_text = response.choices[0].text
print(generated_text)