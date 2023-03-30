import openai
openai.api_key = ""

response = openai.ChatCompletion.create(
  model="gpt-3.5-turbo-0301",
  messages=[
        {"role": "system", "content": "Remove useless and expired feature flags in code."},

        {"role": "user", "content": "I have a piece of code. I need you to help me remove all feature flags written in the code. Here are pre-training examples."},

        {"role": "user", "content": "Prompt 1: Remove all feature flag with key `feature-flag-key` in following code ```csharpint abc=0,a=3,b=4;if(featbitFlags[\"feature-flag-key\"]==true){int c=a+b;return abc+c;} return abc;```"},
        {"role": "user", "content": "Completion 1: ```csharp int abc = 0, a = 3, b = 4; int c = a + b; return abc + c;```"},
        
        {"role": "assistant", "content": "Below is a usage example"},

        {"role": "user", "content": "Prompt Q: Remove all feature flag with key `f0` in following code: ```csharp string total = \"0\", num1 = \"3\", num2 = \"12\"; if(featbitFlags[\"f0\"]==true){ return total + num1 + num2;} return total;```  Please return the code only."},
        {"role": "assistant", "content": "```csharp string total = \"0\", num1 = \"3\", num2 = \"12\"; return total + num1 + num2;```"},

        {"role": "user", "content": "Prompt Q: Remove all feature flag with key `f1` in following code: ```csharp int num1 = 30, num2 = 20; if(featbitFlags[\"f1\"]==true){ return num1 * num2; } return -20;```  Please return the code only."}
    ]
)
print(response)


response = openai.ChatCompletion.create(
  model="gpt-3.5-turbo-0301",
  messages=[
        {"role": "system", "content": "Summarize Last Chat."},
        {"role": "user", "content": "Can you summarize what user said the last request?"},
    ]
)
print(response)