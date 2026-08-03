import type { SdkDefinition, SdkId, SdkSnippetInput } from "./get-started-types"

function javascriptSnippet({ flagKey, secret, eventUrl }: SdkSnippetInput) {
  return `import fbClient from 'featbit-js-client-sdk';

const options = {
  secret: '${secret}',
  api: '${eventUrl}',
  user: {
    name: 'tester',
    keyId: 'tester-id',
    customizedProperties: [{ name: 'group', value: 'qa' }],
  },
};

fbClient.init(options);

const flagValue = fbClient.variation('${flagKey}', false);

fbClient.on('ff_update:${flagKey}', (change) => {
  console.log('Flag updated', change);
});`
}

function nodeSnippet({
  flagKey,
  secret,
  eventUrl,
  streamingUrl,
}: SdkSnippetInput) {
  return `import { FbClientBuilder, UserBuilder } from '@featbit/node-server-sdk';

const client = new FbClientBuilder()
  .sdkKey('${secret}')
  .streamingUri('${streamingUrl}')
  .eventsUri('${eventUrl}')
  .build();

const user = new UserBuilder('tester-id').name('tester').build();

await client.waitForInitialization();
const enabled = await client.boolVariation('${flagKey}', user, false);
console.log('Flag value:', enabled);

await client.flush();`
}

function pythonSnippet({
  flagKey,
  secret,
  eventUrl,
  streamingUrl,
}: SdkSnippetInput) {
  return `from fbclient import get, set_config
from fbclient.config import Config

set_config(Config('${secret}', '${eventUrl}', '${streamingUrl}'))
client = get()

if client.initialize:
    user = {'key': 'tester-id', 'name': 'tester'}
    detail = client.variation_detail('${flagKey}', user, default=False)
    print(f'Flag value: {detail.variation}')

client.stop()`
}

function javaSnippet({
  flagKey,
  secret,
  eventUrl,
  streamingUrl,
}: SdkSnippetInput) {
  return `import co.featbit.commons.model.FBUser;
import co.featbit.server.FBClientImp;
import co.featbit.server.FBConfig;
import co.featbit.server.exterior.FBClient;

FBConfig config = new FBConfig.Builder()
    .streamingURL("${streamingUrl}")
    .eventURL("${eventUrl}")
    .build();

FBClient client = new FBClientImp("${secret}", config);
FBUser user = new FBUser.Builder("tester-id").userName("tester").build();
Boolean enabled = client.boolVariation("${flagKey}", user, false);
System.out.printf("Flag value: %b%n", enabled);

client.close();`
}

function dotnetSnippet({
  flagKey,
  secret,
  eventUrl,
  streamingUrl,
}: SdkSnippetInput) {
  return `using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

var options = new FbOptionsBuilder("${secret}")
    .Event(new Uri("${eventUrl}"))
    .Streaming(new Uri("${streamingUrl}"))
    .Build();

var client = new FbClient(options);
var user = FbUser.Builder("tester-id").Name("tester").Build();
var enabled = client.BoolVariation("${flagKey}", user, false);
Console.WriteLine($"Flag value: {enabled}");

await client.CloseAsync();`
}

function goSnippet({
  flagKey,
  secret,
  eventUrl,
  streamingUrl,
}: SdkSnippetInput) {
  return `package main

import (
    "fmt"
    featbit "github.com/featbit/featbit-go-sdk"
    "github.com/featbit/featbit-go-sdk/interfaces"
)

func main() {
    client, err := featbit.NewFBClient("${secret}", "${streamingUrl}", "${eventUrl}")
    if err != nil { panic(err) }
    defer client.Close()

    user, _ := interfaces.NewUserBuilder("tester-id").UserName("tester").Build()
    value, _, _ := client.BoolVariation("${flagKey}", user, false)
    fmt.Printf("Flag value: %t\\n", value)
}`
}

const javaInstall = `<dependencies>
  <dependency>
    <groupId>co.featbit</groupId>
    <artifactId>featbit-java-sdk</artifactId>
    <version>1.1.1</version>
  </dependency>
</dependencies>

<!-- Gradle: implementation 'co.featbit:featbit-java-sdk:1.1.1' -->`

export const SDK_DEFINITIONS: SdkDefinition[] = [
  {
    id: "javascript",
    label: "JavaScript",
    codeLanguage: "JavaScript",
    installLanguage: "bash",
    recommendedSecretType: "client",
    install: "npm install featbit-js-client-sdk --save",
    documentationUrl: "https://github.com/featbit/featbit-js-client-sdk",
    buildSnippet: javascriptSnippet,
  },
  {
    id: "node",
    label: "Node.js",
    codeLanguage: "TypeScript",
    installLanguage: "bash",
    recommendedSecretType: "server",
    install: "npm install @featbit/node-server-sdk --save",
    documentationUrl: "https://github.com/featbit/featbit-node-server-sdk",
    buildSnippet: nodeSnippet,
  },
  {
    id: "python",
    label: "Python",
    codeLanguage: "Python",
    installLanguage: "bash",
    recommendedSecretType: "server",
    install: "pip install fb-python-sdk",
    documentationUrl: "https://github.com/featbit/featbit-python-sdk",
    buildSnippet: pythonSnippet,
  },
  {
    id: "java",
    label: "Java",
    codeLanguage: "Java",
    installLanguage: "XML",
    recommendedSecretType: "server",
    install: javaInstall,
    documentationUrl: "https://github.com/featbit/featbit-java-sdk",
    buildSnippet: javaSnippet,
  },
  {
    id: "dotnet",
    label: ".NET",
    codeLanguage: "C#",
    installLanguage: "bash",
    recommendedSecretType: "server",
    install: "dotnet add package FeatBit.ServerSdk",
    documentationUrl: "https://github.com/featbit/featbit-dotnet-sdk",
    buildSnippet: dotnetSnippet,
  },
  {
    id: "go",
    label: "Go",
    codeLanguage: "Go",
    installLanguage: "bash",
    recommendedSecretType: "server",
    install: "go get github.com/featbit/featbit-go-sdk",
    documentationUrl: "https://github.com/featbit/featbit-go-sdk",
    buildSnippet: goSnippet,
  },
]

export function getSdkDefinition(id: SdkId) {
  return SDK_DEFINITIONS.find((sdk) => sdk.id === id) ?? SDK_DEFINITIONS[1]
}
