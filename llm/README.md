## Introduction

As ChatGPT (Large Language Model) has gained popularity, terms like Prompt Engineer, Prompt Ops, and LLM Ops have emerged. This got me thinking about whether this powerful model could be applied to practical programming scenarios. So, I decided to test its abilities in a couple of pain points with the Feature Flags on the FeatBit service. I found that both the GPT-3.5 API and GPT-4 Chat interfaces produced impressive results. However, despite fine-tuning the model to a certain extent, the performance of GPT-3 still fell short of my expectations. I have written a blog article that delves into detail about the two scenarios I've tested:

- Utilize ChatGPT for eliminating dead feature flag code
- Leverage prompts for developer tool onboarding

Feel free to check out [our blog article - Developer Tool 2.0](https://www.featbit.co/blogs/LLM-Introducing-FeatBit-ChatGPT-Powered-FeatureFlags-Service), which provides more in-depth information on the two use cases mentioned above.

In conclusion, ChatGPT has shown immense potential in addressing practical programming pain points, such as removing dead feature flags and enhancing developer tool onboarding. While the current performance may not be perfect, it is important to remember that we are still in the early stages of exploring the capabilities of these language models. As more data and real-world use cases become available for pre-training and fine-tuning, we can expect to see significant improvements in the accuracy and usefulness of ChatGPT in a variety of programming scenarios. This not only promises to revolutionize the way developers interact with code, but also paves the way for more accessible and efficient solutions for non-engineers. The future of ChatGPT and similar models is bright, and we eagerly anticipate the advancements they will bring to the software development landscape.

This folder of FeatBit's main repository contains the executive files you can test with for the scenarios I tested.

## Run remove-feature-flag chat-completion cli

In folder `remove-feature-flags`, you see a file `chat-completion-cli.py`. This file is a simple Python program which call the OpenAI's ChatCompletion method to tell ChatGPT-3 to remove dead feature flags and related code.

You can consider that `chat-completion-cli.py` is a prompt service, you call run the python file with pre-requested parameters. This file will prompt a command to the ChatGPT.

Parameters:

- `apikey`, your API Key to cal ChatGPT API service.
- `ffKey`, the feature flag key that you want to remove in your project.
- `variation`, the feature flag return value that you want the program keep the code related to this return value.
- `codePath`, the file path that you want to scan the code and where you want to remove dead feature flags.

You can run the python file with command below:

```shell
python3 chat-completion-cli.py --apikey "fake-bBGB03xcxUQi891GdeqFakeqvOCeTMsOr9rE0M" --ffKey "language" --variation "en-us" --codePath "/mnt/c/Code/featbit/featbit/llm/dotnet-sample/U1Prompt/Program.cs"
```
Then you will get a execution result like below:



