



```shell
python3 chat-completion-cli.py --apikey "" --ffKey "ui-c" --variation "true" --codePath "/mnt/c/Code/featbit/featbit/llm/dotnet-sample/U1Prompt/Program.cs"
```


```shell
export OPENAI_API_KEY="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"

openai api fine_tunes.create -t featbit-fine-tune-model.jsonl -m davinci

openai api fine_tunes.follow -i ft-7hlkp5mY4r6UoFIdPXFZn5HE

openai api fine_tunes.results -i ft-featbit-2023-04-01-03-10-21

prompt = (
        "```csharp public class UProm{public string UP(FbClient c){var user=FbUser.Builder(\"usage\").Name(\"usage\").Build();string total=\"0\",num1=\"3\",num2=\"12\";var ifC=c.BoolVariation(\"ui-c\",user,defaultValue:false);if(ifC==true){return total+num1+num2;}return total;}}``` In the given code, eliminate the feature flags tied to the key `ui-c`, while preserving the code associated with the `true` return value. Also, maintain any other code not related to these feature flags. Ignore the defaultValue. Provide just the code, excluding any descriptions."
    )

openai api completions.create -m davinci:ft-featbit-2023-04-01-03-10-21 -p '```csharp public class UProm{public string UP(FbClient c){var user=FbUser.Builder("usage").Name("usage").Build();string total="0",num1="3",num2="12";var ifC=c.BoolVariation("ui-c",user,defaultValue:false);if(ifC==true){return total+num1+num2;}return total;}}``` In the given code, eliminate the feature flags tied to the key `ui-c`, while preserving the code associated with the `true` return value. Also, maintain any other code not related to these feature flags. Ignore the defaultValue. Provide just the code, excluding any descriptions.'
```

