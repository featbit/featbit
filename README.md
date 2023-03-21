


# [FeatBit](https://featbit.co)    <a href="https://twitter.com/intent/tweet?text=A%20scalable%2C%20fast%2C%20and%20open-source%20Feature%20Management%20platform%20that%20empowers%20all%20teams%20to%20deliver%2C%20control%2C%20monetize%2C%20and%20experiment%20with%20their%20software%20at%20https%3A%2F%2Fgithub.com%2Ffeatbit%2Ffeatbit%0A%0A&hashtags=featureflags,dotnet,opensource,featureflag,featuremanagement&via=RealFeatBit"><img src="https://img.shields.io/twitter/url/http/shields.io.svg?style=social" height=23></a>

[![License](https://img.shields.io/static/v1?style=flat-square&label=license&message=MIT&color=brightgreen)](https://github.com/featbit/featbit/blob/main/LICENSE) <!-- ALL-CONTRIBUTORS-BADGE:START - Do not remove or modify this section -->
[![All Contributors](https://img.shields.io/badge/all_contributors-9-orange.svg?style=flat-square)](#contributors-) <!-- ALL-CONTRIBUTORS-BADGE:END --> [![](https://img.shields.io/badge/.NET-%3E=6.0-6E359E?style=flat-square&logo=csharp&logoColor=white)](https://dotnet.microsoft.com/)
[![](https://img.shields.io/badge/Python-%3E=3.9-FFDD53?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)
[![Angular](https://img.shields.io/badge/Angular-14.0-DD0031?style=flat-square&logo=angular&logoColor=white)](https://angular.io/)   [![Twitter](https://img.shields.io/badge/Twitter-1DA1F2?style=flat-square&logo=twitter&logoColor=white)](https://twitter.com/RealFeatBit)


<h3 align="left">
  <a href="https://www.youtube.com/watch?v=hfww1FpjHV0" >Quick overview (Video)</a>
  <span> · </span>
  <a href="https://featbit.gitbook.io/">Documentation</a>
  <span> · </span>
  <a href="https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ">Online Support (Slack)</a>
  <span> · </span>
  <a href="https://www.featbit.co//blogs?tag=Best+Practice&term=">Best Practice</a>
</h3>


**FeatBit** is a scalable, fast, and 100% open-source feature flags management platform that empowers all teams to deliver, control, experiment with and monetize their software.

![featbit-readme-new-2](https://user-images.githubusercontent.com/68597908/211645725-391777fa-b5c0-4a0c-88e9-df9f05af9c61.gif)

---------------------------------------------------------------------------




## Introduction

Feature flag is a modern engineering technology that decouples code deployments from feature releases, giving you control over who sees each feature and when they see it. 

**FeatBit** provides a holistic framework for managing feature flags that enables teams to use flags on a massive scale across various use cases, such as: 

- Shipping software safer and faster by rolling out features progressively to target users without redeployment.
- Measuring the impact of features’ rollouts and running A/B tests to improve feature quality.
- Giving Sales, CS, and Marketing the ability to fine-tune target audiences and manage customer entitlement.
- etc.

[**Click here to get more information about FeatBit**](https://www.featbit.co/).

## Getting Started

Clone the repository to your server or local machine and boot up the services.
```
git clone https://github.com/featbit/featbit
cd featbit
docker compose up -d
```
Once all containers have started, go to FeatBit's portal [http://localhost:8081](http://localhost:8081) and log in with default credentials.

- username: **test@featbit.com**
- password: **123456**


**Attention** : with the default configuration, the UI is accessible only from the local machine (on which you have run docker compose), please read [**Installation Doc**](https://featbit.gitbook.io/docs/installation#attention) to make it accessible publicly.

You can following the [**Getting Started (Docs)**](https://featbit.gitbook.io/) to start your journey.


## Features

- **Feature flag list**, create, manage, and filter feature flags.
- **Individual targets**, assign individual users to particular flag variation.
- **Targeting users by attribute**, target segments of users by constructing rules.
- **Reusable Segment**, include or exclude individual users from a segment based on user attribtues.
- **Insights**, check out feature usage during the rollout.
- **Flag triggers**, automate changes to your feature flags from external tools.
- **IAM**, define access levels to projects, environment, or teams to enforce your policies.
- **Experimentation**, run feature-level A/B tests anywhere in your stack to make data-driven decisions.
- **Audit Log**, logs for feature flag & segment changes.
- **SDKs for front & back-end**, for Javascript/Typescrit, Java, Python, Go, .NET with more coming soon.
- **Web API**, automate your workflow with Web APIs.
- **Platform-level**, manage your flags in multiple projects and environments.



<!-- - - An online support channel that helps you to quickly solve the problem. -->

<!-- [Community Forum](https://github.com/featbit/featbit/discussions/34) - where you can request new features, ask questions, show-n-tell, etc.

[Architecture](https://featbit.gitbook.io/docs/tech-stack/architecture) - an architecture overview of FeatBit system.

[Benchmark](https://featbit.gitbook.io/docs/tech-stack/benchmark) - the performance report of FeatBit running in non-cluster mode. -->

## Contribute

Building FeatBit is a collaborative effort, and we owe much gratitude to many intelligent and talented individuals. 

[**Join Slack to get your assignment**](https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ). 

## Contributors

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
    </tr>
  </tbody>
</table>

<!-- markdownlint-restore -->
<!-- prettier-ignore-end -->

<!-- ALL-CONTRIBUTORS-LIST:END -->

## License

FeatBit is under the MIT license. See the [LICENSE](https://github.com/featbit/featbit/blob/main/LICENSE) file for details.

