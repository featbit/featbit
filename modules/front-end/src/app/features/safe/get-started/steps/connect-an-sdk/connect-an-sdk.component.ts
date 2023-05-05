import { Component, Input, OnInit } from '@angular/core';

@Component({
  selector: 'connect-an-sdk',
  templateUrl: './connect-an-sdk.component.html',
  styleUrls: ['./connect-an-sdk.component.less']
})
export class ConnectAnSdkComponent implements OnInit {

  @Input() flagKey: string = 'the-flag-key';
  @Input() envSecret: string = 'the-env-secret';

  ngOnInit() {
  }

  javascriptSnippet = `
import fbClient from 'featbit-js-client-sdk';

const option = {
  secret: '${this.envSecret}',
  user: {
    name: 'Bot',
    keyId: 'bot-id',
    customizedProperties: [
      {
        'name': 'level',
        'value': 'high'
      }
    ]
  }
};

// initialization
fbClient.init(option);

// evaluation
const flagValue = fbClient.variation('${this.flagKey}', defaultValue);

// subscribe to flag change
fbClient.on('ff_update:YOUR_FEATURE_KEY', (change) => {
  // change has this structure {id: 'the feature_flag_key', oldValue: theOldValue, newValue: theNewValue }
  // the type of theOldValue and theNewValue is defined on FeatBit

  // defaultValue should have the same type as theOldValue and theNewValue
  const myFeature = fbClient.variation('YOUR_FEATURE_KEY', defaultValue);
});
  `;

  csharpSnippet = `
using FeatBit.Sdk.Server;
using FeatBit.Sdk.Server.Model;

// Set secret to your FeatBit SDK secret.
const string secret = "${this.envSecret}";

// Creates a new client instance that connects to FeatBit with the default option.
var client = new FbClient(secret);
if (!client.Initialized)
{
    Console.WriteLine("FbClient failed to initialize. Exiting...");
}
else
{
    Console.WriteLine("FbClient successfully initialized!");
}

// flag to be evaluated
const string flagKey = "${this.flagKey}";

// create a user
var user = FbUser.Builder("anonymous").Build();

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
