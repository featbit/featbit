```shell
export OPENAI_API_KEY=""
```

```shell
openai api fine_tunes.create -t featbit-fine-tune-rm-ff-beta-001.jsonl -m davinci

openai api fine_tunes.follow -i ft-ejfRvG4sYnmPYmLg60vXHVcX
openai api fine_tunes.follow -i ft-i33ftlPCiNPXEVvaNEHRP9zH
```

```shell
openai api fine_tunes.create -t featbit-fine-tune-rm-ff-beta-002.jsonl -m davinci

openai api fine_tunes.follow -i ft-M4Vwpib2B1WeL6sJYkgJ0kfe
```

```shell
openai api fine_tunes.create -t featbit-fine-tune-rm-ff-beta-003.jsonl -m davinci

openai api fine_tunes.follow -i ft-gp7eYCwYfDvn3ld6TH8Fuplf
```

```shell
openai api fine_tunes.create -t featbit-fine-tune-rm-ff-beta-004.jsonl -m davinci

openai api fine_tunes.follow -i ft-cOe7Z5Fe18T336ibu0hYqV75
```

Search "What are tokens and how to count them?" in documentation to understand how token is consumed


[https://openai.com/pricing](https://openai.com/pricing)

| Model | Prompt | Completion |
| --- | --- | --- |
| 8K context | $0.03 / 1K tokens | $0.06 / 1K tokens |
| 32K context | $0.06 / 1K tokens | $0.12 / 1K tokens |


[https://platform.openai.com/tokenizer](https://platform.openai.com/tokenizer)


We should give GPT power to self create fine-tune data.


```shell
openai api fine_tunes.create -t featbit-fine-tune-rm-ff-beta-005.jsonl -m davinci --n_epochs 1

openai api fine_tunes.follow -i ft-lROGdDlR0NJeMwCdUjSJOPlK
openai api fine_tunes.cancel -i ft-lROGdDlR0NJeMwCdUjSJOPlK

openai api fine_tunes.follow -i ft-5yu3Aj2RxdAvD7fkQefBtZID
```



```shell
openai api fine_tunes.create -t featbit-fine-tune-rm-ff-beta-001.jsonl -m text-davinci-003 --n_epochs 1
```

openai api fine_tunes.create -t featbit-fine-tune-model.jsonl -m davinci --n_epochs 4