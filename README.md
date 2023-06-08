
![image](https://github.com/featbit/featbit/assets/68597908/ff7a611e-9504-4f99-bf11-8ba9bccea696)


<div id="header" align="center">
  <div id="badges">
  <a href="https://github.com/featbit/featbit/blob/main/LICENSE">
    <img src="https://img.shields.io/static/v1?style=flat-square&label=license&message=MIT&color=brightgreen" />
  </a>
  <a href="https://twitter.com/RealFeatBit">
    <img src="https://img.shields.io/badge/Twitter-1DA1F2?style=flat-square&logo=twitter&logoColor=white"/>
  </a>  
  <a href="https://medium.com/@featbit">
    <img src="https://img.shields.io/badge/Medium-grey?style=flat-square&logo=medium&logoColor=white" alt="Read about RATH on medium"/>
  </a>
  <a href="https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ">
    <img src="https://img.shields.io/badge/Slack-green?style=flat-square&logo=slack&logoColor=white" alt="Join FeatBit on Slack"/>
  </a> 
  <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
  <a href="https://join.slack.com/t/kanaries-community/shared_invite/zt-1pcosgbua-E_GBPawQOI79C41dPDyyvw">
    <img src="https://img.shields.io/badge/all_contributors-16-orange.svg?style=flat-square"/>
  </a> 
  <!-- ALL-CONTRIBUTORS-BADGE:END -->
  </div>
  <div id="badges">
  <a href="https://dotnet.microsoft.com/">
    <img src="https://img.shields.io/badge/.NET-%3E=6.0-6E359E?style=flat-square&logo=csharp&logoColor=white"/>
  </a>
  <a href="https://www.python.org/">
    <img src="https://img.shields.io/badge/Python-%3E=3.9-FFDD53?style=flat-square&logo=python&logoColor=white"/>
  </a>
  <a href="https://angular.io/">
    <img src="https://img.shields.io/badge/Angular-14.0-DD0031?style=flat-square&logo=angular&logoColor=white"/>
  </a>
</div>
</div>

## Try FeatBit Online

Try FeatBit immediately with [our online demo](https://tryitonline.featbit.co). The video below shows you how to get started quickly.

https://github.com/featbit/featbit/assets/68597908/d836702d-6096-4025-9b9e-5128a8b52dcb

## About FeatBit

[FeatBit](https://www.featbit.co) is an open-source [feature flags](https://blog.jetbrains.com/space/2022/06/16/feature-flags/) management tool that empowers developers:

**Ship Code Safely**. Mitigate risks with Production Testing, roll out features to 1% of users initially then expanding progressively, and ensure instant error recovery without redeployment.

**Targeted Experiences**. Giving you control over who sees each feature and when they see it. Release features to specific target users, and continuously measure and improve your buisness. 

**Innovate Faster**. Decouples code deployments from feature releases. Deploy at will, and release any feature immediately upon request from the boss.

**Host Anywhere**. FeatBit allows you to host your feature flags service wherever your business needs it, ensuring compliance and data protection.

**Born for developers**. Use simple if/else statements to control and release features, eliminating complex DevOps tasks. This enables developers to directly drive business value.

<a href="https://www.featbit.co">
  <img src="https://github.com/featbit/featbit/assets/68597908/eed06178-7b10-4d60-a932-83e8627f52b6" width="100%" />
</a>


## Self-Hosting FeatBit

[Self-hosting Guide](https://docs.featbit.co/docs/installation/full-installation) | [K8s Manifests](https://github.com/featbit/featbit/tree/main/kubernetes)

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
> By default, FeatBit's portal is only accessible from the local machine where Docker Compose is running. If you want to make it publicly accessible, refer to the [**FAQ**](https://docs.featbit.co/docs/installation/faq#how-to-make-featbit-portal-accessible-publicly) for instructions.


### 2. Connect an SDK

Find your preferred SDK in our list of [official SDKs](https://featbit.gitbook.io/sdks) and import it into your project. Follow the setup guides for your specific SDK.

You can also learn how to connect an SDK in the "Getting Started" section after logging in to the Portal for the first time.

![image](https://github.com/featbit/featbit/assets/68597908/f6fe85dd-0753-4896-8f84-fa17c0037c21)


### 3. Check a feature flag

To check the state of a feature flag in your code, you just need a simple function call to verify the expected value. Here's how it might look in C#:

```csharp
if (featBit.BoolVariation("feature-a")) {
  // run new feature
} 
else {
  // run old version or do nothing
}
```

## Configure and run FeatBit anywhere

The above sections show you how to get up and running quickly and easily. When you're ready to start configuring and customizing FeatBit for your own environment, check out the [Installation Documentation](https://docs.featbit.co/docs/installation/full-installation), [K8s Manifest Files](https://github.com/featbit/featbit/tree/main/kubernetes) and [FeatBit Agent Documentation](https://docs.featbit.co/docs/featbit-agent/featbit-agent) for getting started with self-managed deployments, FeatBit configuration options, or running FeatBit locally via docker.

<div align="center">
<img src="https://github.com/featbit/featbit/assets/68597908/0068d041-0c49-4a5e-a308-28732cb98abe" width="600px" align="center" />
  </div>


## Documentation & Community

[Official Documentation](https://docs.featbit.co)

[Join our Online Slack Support & Community](https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ)

[Official Website](https://www.featbit.co)

## Features

FeatBit offers a range of features including:

- **SDKs** for [**JavaScript**](https://github.com/featbit/featbit-js-client-sdk), [**C#**](https://github.com/featbit/dotnet-server-sdk), [**Java**](https://github.com/featbit/featbit-java-sdk), [**Python**](https://github.com/featbit/featbit-python-sdk), and [**Go**](https://github.com/featbit/featbit-go-sdk), with more to come.

- **[Managing Feature flags](https://docs.featbit.co/docs/feature-flags/organizing-flags/the-flags-list)**: Create, manage, and filter feature flags.

- **[Targeting users with flags](https://docs.featbit.co/docs/feature-flags/targeting-users-with-flags)**: Assign individual users to specific flag variations.

- **[Reusable Segments](https://docs.featbit.co/docs/feature-flags/users-and-user-segments)**: Include or exclude users from a segment based on user attributes.

- **[Insights](https://docs.featbit.co/docs/feature-flags/the-flag-insights)**: Gain insights into feature usage during the rollout.

- **[IAM](https://docs.featbit.co/docs/iam/about)**: Define access levels to projects, environments, or teams to enforce your policies.

- **[Experimentation](https://docs.featbit.co/docs/experimentation/understanding-experimentation)**: Run feature-level A/B tests anywhere in your stack to make data-driven decisions.

- **[Audit Log](https://docs.featbit.co/docs/feature-flags/audit-log)**: Keep track of feature flag and segment changes.

- **[Feature Workflow](https://docs.featbit.co/docs/feature-flags/feature-workflow)**: Control your use of feature flags by creating complex automated workflows within FeatBit.

- **[Web APIs](https://docs.featbit.co/docs/integrations/using-featbit-rest-api)**, automate your workflow with Web APIs.

- **[Platform-level](https://docs.featbit.co/docs/feature-flags/organizing-flags/projects)**, manage your flags in multiple projects and environments.

- **[Pro Solution for Big Data](https://docs.featbit.co/docs/tech-stack/standard-vs.-professional)**, a [professional version](https://docs.featbit.co/docs/tech-stack/architecture-professional) tailored for teams and companies to accommodate in excess of millions of daily online users with feature usage, custom events, and A/B testing insights.

- **Relay Proxy/Agent**: Host a feature flag service in your customers' private environments or reduce network latency for your end users.

- **Integrations** (experimental features): Export data to third-party system monitoring services, data analytics services, workflow tools, or any other tools that can optimize your entire workflow.

- **ChatGPT Tech Debt Reduction** (experimental features): Utilize ChatGPT4 and FeatBit's VSCode extension to minimize technical debt associated with feature flagging.

![featbit-readme-new-2](https://user-images.githubusercontent.com/68597908/211645725-391777fa-b5c0-4a0c-88e9-df9f05af9c61.gif)

## Contribute

Building FeatBit is a collaborative effort, and we owe much gratitude to many intelligent and talented individuals. 

[**Join Slack to get your assignment**](https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ). 

### Contributors

<!-- ALL-CONTRIBUTORS-LIST:START - Do not remove or modify this section -->
<!-- prettier-ignore-start -->
<!-- markdownlint-disable -->
<table>
  <tbody>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/cosmos-explorer"><img src="https://avatars.githubusercontent.com/u/88151306?v=4?s=100" width="100px;" alt="cosmos-explorer"/><br /><sub><b>cosmos-explorer</b></sub></a><br /><a href="#userTesting-cosmos-explorer" title="User Testing">📓</a> <a href="https://github.com/featbit/featbit/commits?author=cosmos-explorer" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/deleteLater"><img src="https://avatars.githubusercontent.com/u/34052208?v=4?s=100" width="100px;" alt="deleteLater"/><br /><sub><b>deleteLater</b></sub></a><br /><a href="https://github.com/featbit/featbit/commits?author=deleteLater" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/dsun0720"><img src="https://avatars.githubusercontent.com/u/38680131?v=4?s=100" width="100px;" alt="s2002a"/><br /><sub><b>s2002a</b></sub></a><br /><a href="https://github.com/featbit/featbit/commits?author=dsun0720" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/FeatBit"><img src="https://avatars.githubusercontent.com/u/68597908?v=4?s=100" width="100px;" alt="Comiscience"/><br /><sub><b>Comiscience</b></sub></a><br /><a href="https://github.com/featbit/featbit/commits?author=cosmic-flood" title="Documentation">📖</a><a href="https://github.com/featbit/featbit/commits?author=cosmic-flood" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/san-ki"><img src="https://avatars.githubusercontent.com/u/66792330?v=4?s=100" width="100px;" alt="Sanket"/><br /><sub><b>Sanket</b></sub></a><br /><a href="https://github.com/featbit/featbit/commits?author=san-ki" title="Code">💻</a><a href="https://github.com/featbit/featbit/commits?author=san-ki" title="Medal">🥇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/sagar110599"><img src="https://avatars.githubusercontent.com/u/46983757?v=4?s=100" width="100px;" alt="sagar110599"/><br /><sub><b>sagar110599</b></sub></a><br /><a href="https://github.com/featbit/featbit/commits?author=sagar110599" title="Code">💻</a><a href="https://github.com/featbit/featbit/commits?author=sagar110599" title="Medal">🥇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/DaveFz"><img src="https://avatars.githubusercontent.com/u/47706547?v=4?s=100" width="100px;" alt="Dave"/><br /><sub><b>Dave</b></sub></a><br /><a href="https://github.com/featbit/featbit/commits?author=DaveFz" title="Code">💻</a><a href="https://github.com/featbit/featbit/commits?author=DaveFz" title="Medal">🥇</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://www.linkedin.com/in/kabirhasan/"><img src="https://avatars.githubusercontent.com/u/29860651?v=4?s=100" width="100px;" alt="Kabir Hasan"/><br /><sub><b>Kabir Hasan</b></sub></a><br /><a href="https://github.com/featbit/featbit/commits?author=kabir-webDev" title="Code">💻</a><a href="https://github.com/featbit/featbit/commits?author=kabir-webDev" title="Medal">🥇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Michaelg22"><img src="https://avatars.githubusercontent.com/u/62085623?v=4?s=100" width="100px;" alt="MikeG"/><br /><sub><b>MikeG</b></sub></a><br /><a href="https://github.com/featbit/featbit/commits?author=Michaelg22" title="Code">💻</a><a href="https://github.com/featbit/featbit/commits?author=Michaelg22" title="Medal">🥇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://michaelyuhe.zeabur.app/"><img src="https://avatars.githubusercontent.com/u/63531512?v=4?s=100" width="100px;" alt="夏宇航"/><br /><sub><b>夏宇航</b></sub></a><br /><a href="https://github.com/featbit/featbit/commits?author=MichaelYuhe" title="Code">💻</a><a href="https://github.com/featbit/featbit/commits?author=MichaelYuhe" title="Medal">🥇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://linktr.ee/exilon"><img src="https://avatars.githubusercontent.com/u/80382462?v=4?s=100" width="100px;" alt="Exilon"/><br /><sub><b>Exilon</b></sub></a><br /><a href="https://github.com/featbit/featbit/commits?author=Exilon24" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/fMoro1999"><img src="https://avatars.githubusercontent.com/u/49589241?v=4?s=100" width="100px;" alt="Francesco Moro"/><br /><sub><b>Francesco Moro</b></sub></a><br /><a href="https://github.com/featbit/featbit/commits?author=fMoro1999" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="http://webstaurantstore.com"><img src="https://avatars.githubusercontent.com/u/128187904?v=4?s=100" width="100px;" alt="rbrennan"/><br /><sub><b>rbrennan</b></sub></a><br /><a href="https://github.com/featbit/featbit/commits?author=wss-rbrennan" title="Code">💻</a><a href="https://github.com/featbit/featbit/commits?author=wss-rbrennan" title="Medal">🥇</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/mucoban"><img src="https://avatars.githubusercontent.com/u/80916997?v=4?s=100" width="100px;" alt="Mücahit Çoban"/><br /><sub><b>Mücahit Çoban</b></sub></a><br /><a href="https://github.com/featbit/featbit/commits?author=mucoban" title="Code">💻</a></td>
    </tr>
    <tr>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/Shubh8899"><img src="https://avatars.githubusercontent.com/u/63413220?v=4?s=100" width="100px;" alt="Shubham Chauhan"/><br /><sub><b>Shubham Chauhan</b></sub></a><br /><a href="https://github.com/featbit/featbit/commits?author=Shubh8899" title="Code">💻</a></td>
      <td align="center" valign="top" width="14.28%"><a href="https://github.com/defqd"><img src="https://avatars.githubusercontent.com/u/104916752?v=4?s=100" width="100px;" alt="defqd"/><br /><sub><b>defqd</b></sub></a><br /><a href="https://github.com/featbit/featbit/commits?author=defqd" title="Code">💻</a></td>
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## License

FeatBit is under the MIT license. See the [LICENSE](https://github.com/featbit/featbit/blob/main/LICENSE) file for details.

