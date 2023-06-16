import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges } from '@angular/core';
import { environment } from 'src/environments/environment';
import { copyToClipboard } from "@utils/index";
import { NzMessageService } from "ng-zorro-antd/message";
import { IEnvironment, ISecret, SecretTypeEnum } from "@shared/types";
import { getCurrentProjectEnv } from "@utils/project-env";
import { EnvService } from "@services/env.service";

@Component({
  selector: 'connect-an-sdk',
  templateUrl: './connect-an-sdk.component.html',
  styleUrls: ['./connect-an-sdk.component.less']
})
export class ConnectAnSdkComponent implements OnChanges {

  @Input() flagKey: string = 'the-flag-key';
  @Output() onPrev = new EventEmitter<void>();
  @Output() onComplete = new EventEmitter<void>();

  protected readonly SecretTypeEnum = SecretTypeEnum;

  streamingURL: string = environment.evaluationUrl?.replace(/^http/, 'ws');
  eventURL: string = environment.evaluationUrl;
  apiHost: string = environment.url;

  selectedSecret: ISecret;
  get secret(): string {
    return this.selectedSecret?.value ?? 'the-sdk-secret';
  }

  env: IEnvironment;

  constructor(
    private message: NzMessageService,
    private envService: EnvService
  ) {
    const projectEnv = getCurrentProjectEnv();
    this.envService.getEnv(projectEnv.projectId, projectEnv.envId).subscribe({
      next: env => {
        this.env = env;
        this.selectedSecret = env.secrets[0];
        this.buildSnippets();
      },
      error: () => {
        this.message.error($localize`:@@common.error-occurred-try-again:Error occurred, please try again`);
      }
    });
  }

  ngOnChanges(changes: SimpleChanges): void {
    // update snippets when flagKey changed
    if (changes.flagKey) {
      this.buildSnippets();
    }
  }

  buildSnippets() {
    this.jsSnippet = this.buildJsSnippet();
    this.pythonSnippet = this.buildPythonSnippet();
    this.javaSnippet = this.buildJavaSnippet();
    this.csharpSnippet = this.buildCSharpSnippet();
    this.goSnippet = this.buildGoSnippet();
  }

  copyText(text: string) {
    copyToClipboard(text).then(
      () => this.message.success($localize`:@@common.copy-success:Copied`)
    );
  }

  jsSnippet: string;
  pythonSnippet: string;
  javaSnippet: string;
  csharpSnippet: string;
  goSnippet: string;

  tester = {
    id: 'tester-id',
    name: 'tester',
    group: 'qa'
  };

  private buildJsSnippet(): string {
    return `
import fbClient from 'featbit-js-client-sdk';

const option = {
  secret: '${this.secret}',
  api: '${this.eventURL}',
  user: {
    name: '${this.tester.name}',
    keyId: '${this.tester.id}',
    customizedProperties: [
      {
        'name': 'group',
        'value': '${this.tester.group}'
      }
    ]
  }
};

// initialization
fbClient.init(option);

// evaluation
const flagValue = fbClient.variation('${this.flagKey}', defaultValue);

// subscribe to flag change
fbClient.on('ff_update:${this.flagKey}', (change) => {
  // change has this structure {id: '${this.flagKey}', oldValue: theOldValue, newValue: theNewValue }
  // the type of theOldValue and theNewValue is defined on FeatBit
});
  `;
  }

  private buildPythonSnippet() {
    return `
from fbclient import get, set_config
from fbclient.config import Config

env_secret = '${this.secret}'
event_url = '${this.eventURL}'
streaming_url = '${this.streamingURL}'

set_config(Config(env_secret, event_url, streaming_url))
client = get()

if client.initialize:
    flag_key = '${this.flagKey}'
    user_key = '${this.tester.id}'
    user_name = '${this.tester.name}'
    user = {'key': user_key, 'name': user_name}
    detail = client.variation_detail(flag_key, user, default=None)
    print(f'flag {flag_key} returns {detail.variation} for user {user_key}, reason: {detail.reason}')

# ensure that the SDK shuts down cleanly and has a chance to deliver events
# to FeatBit before the program exits
client.stop()
    `;
  }

  private buildJavaSnippet() {
    return `
import co.featbit.commons.model.FBUser;
import co.featbit.commons.model.EvalDetail;
import co.featbit.server.FBClientImp;
import co.featbit.server.FBConfig;
import co.featbit.server.exterior.FBClient;

import java.io.IOException;

class Main {
    public static void main(String[] args) throws IOException {
        String envSecret = "${this.secret}";
        String eventUrl = "${this.eventURL}";
        String streamUrl = "${this.streamingURL}";

        FBConfig config = new FBConfig.Builder()
                .streamingURL(streamUrl)
                .eventURL(eventUrl)
                .build();

        FBClient client = new FBClientImp(envSecret, config);
        if (client.isInitialized()) {
            // The flag key to be evaluated
            String flagKey = "${this.flagKey}";

            // The user
            FBUser user = new FBUser.Builder("${this.tester.id}")
                    .userName("${this.tester.name}")
                    .build();

            // Evaluate a boolean flag for a given user
            Boolean flagValue = client.boolVariation(flagKey, user, false);
            System.out.printf("flag %s, returns %b for user %s%n", flagKey, flagValue, user.getUserName());

            // Evaluate a boolean flag for a given user with evaluation detail
            EvalDetail<Boolean> ed = client.boolVariationDetail(flagKey, user, false);
            System.out.printf("flag %s, returns %b for user %s, reason: %s%n", flagKey, ed.getVariation(), user.getUserName(), ed.getReason());
        }

        // Close the client to ensure that all insights are sent out before the app exits
        client.close();
        System.out.println("APP FINISHED");
    }
}
    `;
  }

  private buildCSharpSnippet() {
    return `
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;
using FeatBit.Sdk.Server.Options;

// setup sdk options
var options = new FbOptionsBuilder("${this.secret}")
    .Event(new Uri("${this.eventURL}"))
    .Steaming(new Uri("${this.streamingURL}"))
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
const string flagKey = "${this.flagKey}";

// create a user
var user = FbUser.Builder("${this.tester.id}").Name("${this.tester.name}").Build();

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
  `
  }

  private buildGoSnippet() {
    return `
package main

import (
    "fmt"
    "github.com/featbit/featbit-go-sdk"
    "github.com/featbit/featbit-go-sdk/interfaces"
)

func main() {
    envSecret := "${this.secret}"
    eventUrl := "${this.eventURL}"
    streamingUrl := "${this.streamingURL}"

    client, err := featbit.NewFBClient(envSecret, streamingUrl, eventUrl)

    defer func() {
        if client != nil {
            // ensure that the SDK shuts down cleanly and has a chance to deliver events
            // to FeatBit before the program exits
            _ = client.Close()
        }
    }()

    if err == nil && client.IsInitialized() {
        user, _ := interfaces.NewUserBuilder("${this.tester.id}").UserName("${this.tester.name}").Build()
        _, ed, _ := client.BoolVariation("${this.flagKey}", user, false)
        fmt.Printf("flag %s, returns %s for user %s, reason: %s \\n", ed.KeyName, ed.Variation, user.GetKey(), ed.Reason)
    } else {
        fmt.Println("SDK initialization failed")
    }
}
    `;
  }
}
