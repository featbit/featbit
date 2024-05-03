
![image](https://github.com/featbit/featbit/assets/68597908/ff7a611e-9504-4f99-bf11-8ba9bccea696)

<div id="header" align="center">
  <div id="badges">
    <a href="https://github.com/featbit/featbit/blob/main/LICENSE">
      <img src="https://img.shields.io/static/v1?style=flat-square&label=license&message=MIT&color=brightgreen" />
    </a>
    <a href="https://twitter.com/RealFeatBit">
      <img src="https://img.shields.io/badge/Twitter-1DA1F2?style=flat-square&logo=twitter&logoColor=white"/>
    </a>  
    <a href="https://awsmfoss.com/featbit/">
      <img src="https://img.shields.io/badge/Awesome_F%2FOSS-Certified-purple?style=flat-square" alt="Read about RATH on medium"/>
    </a>
    <a href="https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ">
      <img src="https://img.shields.io/badge/Slack-green?style=flat-square&logo=slack&logoColor=white" alt="Join FeatBit on Slack"/>
    </a>
    </div>
    <div id="badges">
    <a href="https://dotnet.microsoft.com/">
      <img src="https://img.shields.io/badge/.NET-%3E=6.0-6E359E?style=flat-square&logo=csharp&logoColor=white"/>
    </a>
    <a href="https://www.python.org/">
      <img src="https://img.shields.io/badge/Python-%3E=3.9-FFDD53?style=flat-square&logo=python&logoColor=white"/>
    </a>
    <a href="https://angular.io/">
      <img src="https://img.shields.io/badge/Angular-16.0-DD0031?style=flat-square&logo=angular&logoColor=white"/>
    </a>
  </div>

  <br/>
  <div id="links">
    <a href="https://docs.featbit.co">
      Documentation
    </a>
    |
    <a href="https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ">
      Community (Slack)
    </a>
    |
    <a href="https://www.linkedin.com/company/featbit">
      LinkedIn
    </a>
    |
    <a href="mailto:contact@featbit.co">
      Email
    </a>
  </div>

  
</div>

<br/>


## Try FeatBit Online

Try FeatBit immediately with [our online demo](https://tryitonline.featbit.co). The video below shows you how to get started quickly.

https://github.com/featbit/featbit/assets/68597908/d836702d-6096-4025-9b9e-5128a8b52dcb

## About FeatBit

[FeatBit](https://www.featbit.co) is an open-source [feature flags](https://blog.jetbrains.com/space/2022/06/16/feature-flags/) management tool that empowers developers:

**Ship Code Safely**. Mitigate risks with Production Testing, roll out features to 1% of users initially then expanding progressively, and ensure instant error recovery without redeployment.

**Targeted Experiences**. Giving you control over who sees each feature and when they see it. Release features to specific target users, and continuously measure and improve your business.

**Innovate Faster**. Decouples code deployments from feature releases. Deploy at will, and release any feature immediately upon request from the boss.

**Host Anywhere**. FeatBit allows you to host your feature flags service wherever your business needs it, ensuring compliance and data protection.

**Born for developers**. Use simple if/else statements to control and release features, eliminating complex DevOps tasks. This enables developers to directly drive business value.

<a href="https://www.featbit.co">
  <img src="https://github.com/featbit/featbit/assets/68597908/eed06178-7b10-4d60-a932-83e8627f52b6" width="100%" />
</a>

## Get started in 3 steps

### 1. Start FeatBit

To self-host FeatBit with Docker, Run this script:

```
git clone https://github.com/featbit/featbit
cd featbit
docker compose up -d
```

Once all containers have started, you can access FeatBit's portal at [http://localhost:8081](http://localhost:8081) and log in with the default credentials:

- Username: **test@featbit.com**
- Password: **123456**

> **Note**
> By default, FeatBit's portal is only accessible from the local machine where Docker Compose is running. If you want to make it publicly accessible, refer to the [**FAQ**](https://docs.featbit.co/installation/faq#how-to-make-featbit-portal-accessible-publicly) for instructions.

### 2. Connect an SDK

Find your preferred SDK in our list of [official SDKs](https://docs.featbit.co/sdk/overview) and import it into your project. Follow the setup guides for your specific SDK.

You can also learn how to connect an SDK in the "Getting Started" section after logging in to the Portal for the first time.

![image](https://github.com/featbit/featbit/assets/68597908/f6fe85dd-0753-4896-8f84-fa17c0037c21)

### 3. Check a feature flag

To check the state of a feature flag in your code, you just need a simple function call to verify the expected value. Here's how it might look in C#:

```csharp
var user = FbUser.Builder("tester-id").Name("tester").Build();
if (featbit.BoolVariation("user-new-algorithm", user, defaultValue: false))
{
    // run new algorithm
}
else
{
    // run old algorithm
}
```

--------

🙏 If you are using FeatBit, we have launched the [**FeatBit Usage Survey**](https://forms.gle/gZT715wE9aMPpoBw8). It would be greatly appreciated and incredibly helpful if you could take the time to fill it out (5 questions).

--------

## Configure and run FeatBit anywhere

The above sections show you how to get up and running quickly and easily. When you're ready to start configuring and customizing FeatBit for your own environment, check out the [Installation Documentation](https://docs.featbit.co/installation/full-installation), [K8s Manifest Files](https://github.com/featbit/featbit/tree/main/kubernetes) and [FeatBit Agent Documentation](https://docs.featbit.co/relay-proxy/featbit-agent) for getting started with self-managed deployments, FeatBit configuration options, or running FeatBit locally via docker.

## Documentation & Community

[Official Documentation](https://docs.featbit.co)

[Join our Online Slack Support & Community](https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ)

[Connect with FeatBit on LinkedIn](https://www.linkedin.com/company/featbit)

Email us at [contact@featbit.co](mailto:contact@featbit.co) if Slack isn't your thing.

[Official Website](https://www.featbit.co)

## Features

FeatBit offers a range of features including:

- **[SDKs](https://docs.featbit.co/sdk/overview)** for [**.NET(C#)**](https://github.com/featbit/dotnet-server-sdk), [**JavaScript**](https://github.com/featbit/featbit-js-client-sdk), [**React**](https://github.com/featbit/featbit-react-client-sdk), [**NodeJs**](https://github.com/featbit/featbit-node-server-sdk), [**Java**](https://github.com/featbit/featbit-java-sdk), [**Python**](https://github.com/featbit/featbit-python-sdk), [**Go**](https://github.com/featbit/featbit-go-sdk), and [**OpenFeature Providers**](https://docs.featbit.co/sdk/overview#openfeature-providers), with more to come.

- **[Managing Feature flags](https://docs.featbit.co/feature-flags/organizing-flags/the-flags-list)**: Create, manage, and filter feature flags.

- **[Targeting users with flags](https://docs.featbit.co/feature-flags/targeting-users-with-flags)**: Assign individual users to specific flag variations.

- **[Reusable Segments](https://docs.featbit.co/feature-flags/users-and-user-segments)**: Include or exclude users from a segment based on user attributes.

- **[Insights](https://docs.featbit.co/feature-flags/the-flag-insights)**: Gain insights into feature usage during the rollout.

- **[IAM](https://docs.featbit.co/iam/overview)**: Define access levels to projects, environments, or teams to enforce your policies.

- **[Experimentation](https://docs.featbit.co/experimentation/understanding-experimentation)**: Run feature-level A/B tests anywhere in your stack to make data-driven decisions.

- **[Audit Log](https://docs.featbit.co/feature-flags/audit-log)**: Keep track of feature flag and segment changes.

- **[Feature Workflow](https://docs.featbit.co/feature-flags/feature-workflow)**: Control your use of feature flags by creating complex automated workflows within FeatBit (Flag Triggers, Scheduled Flag Changes, Change Approve Requests).

- **[Web APIs](https://docs.featbit.co/api-docs/overview)**, automate your workflow with Web APIs.

- **[SSO](https://docs.featbit.co/integrations/single-sign-on)**, integrate with your existing Identity Provider.

- **[Platform-level](https://docs.featbit.co/feature-flags/organizing-flags/projects)**, manage your flags in multiple projects and environments.

- **[Pro Solution for Big Data](https://docs.featbit.co/tech-stack/standard-vs.-professional)**, a [professional version](https://docs.featbit.co/tech-stack/architecture-professional) tailored for teams and companies to accommodate in excess of millions of daily online users with feature usage, custom events, and A/B testing insights.

- **[Relay Proxy/Agent](https://docs.featbit.co/relay-proxy/relay-proxy)**: Host a feature flag service in your customers' private environments or reduce network latency for your end users.

- **Powerful Integrations**: Our feature-rich [WebHook](https://docs.featbit.co/integrations/webhooks) allows seamless integration with various tools and workflows: [DataDog](https://docs.featbit.co/integrations/observability/datadog), [New Relic Ones](https://docs.featbit.co/integrations/observability/newrelic), [Grafana](https://docs.featbit.co/integrations/observability/grafana), [Growthbook](https://docs.featbit.co/integrations/data-analytic/growthbook), [Slack](https://docs.featbit.co/integrations/chat-apps/slack) and more.

- **[ChatGPT Tech Debt Reduction](https://github.com/featbit/featbit/tree/main/llm)** (experimental features): Utilize ChatGPT4 and FeatBit's VSCode extension to minimize technical debt associated with feature flagging.

- **[OpenTelemetry Integration](https://docs.featbit.co/integrations/observability/opentelemetry)**: Enhance system visibility with OpenTelemetry for logs, traces, and metrics.

- **[Helm Charts Installation](https://github.com/featbit/featbit-charts/)**, FeatBit can be installed on-premises, in the cloud, or in a hybrid environment through Helm Charts.

![featbit-readme-new-2](https://user-images.githubusercontent.com/68597908/211645725-391777fa-b5c0-4a0c-88e9-df9f05af9c61.gif)

## Contribute

Building FeatBit is a collaborative effort, and we owe much gratitude to many intelligent and talented individuals.

[**Join Slack to get your assignment**](https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ).

### Contributors

We would like to express our gratitude to all the individuals who have already contributed to FeatBit!

<a href="https://github.com/featbit/featbit/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=featbit/featbit" />
</a>

Made with [contrib.rocks](https://contrib.rocks).

## License

FeatBit is an Open Core product. The bulk of the code is under permissive MIT license. See the [LICENSE](https://github.com/featbit/featbit/blob/main/LICENSE) file for details.

The following listed features are protected by a commercial license key, please contact us by [Slack](https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ) or [Email](mailto:contact@featbit.co) to get a license key or a trial license key:
- Schedule
- Change request
- SSO
- Multi-organizations

