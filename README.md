

## FeatBit    <a href="https://twitter.com/intent/tweet?text=A%20scalable%2C%20high-performance%2C%20and%20open-source%20Feature%20Management%20platform%20that%20empowers%20all%20teams%20to%20deliver%2C%20control%2C%20monetize%2C%20and%20experiment%20with%20their%20software%20at%20https%3A%2F%2Fgithub.com%2Ffeatbit%2Ffeatbit%0A%0A&hashtags=featureflags,dotnet,opensource,featureflag,featuremanagement&via=RealFeatBit"><img src="https://img.shields.io/twitter/url/http/shields.io.svg?style=social" height=23></a>

[![License](https://img.shields.io/static/v1?style=for-the-badge&label=license&message=MIT&color=brightgreen)](https://github.com/featbit/featbit/blob/main/LICENSE) [![](https://img.shields.io/badge/.NET-%3E=6.0-6E359E?style=for-the-badge&logo=csharp&logoColor=white)](https://dotnet.microsoft.com/)
[![](https://img.shields.io/badge/Python-%3E=3.9-FFDD53?style=for-the-badge&logo=python&logoColor=white)](https://www.python.org/)
[![Angular](https://img.shields.io/badge/Angular-14.0-DD0031?style=for-the-badge&logo=angular&logoColor=white)](https://angular.io/)   [![Twitter](https://img.shields.io/badge/Twitter-1DA1F2?style=for-the-badge&logo=twitter&logoColor=white)]([https://angular.io/](https://twitter.com/RealFeatBit))     



**FeatBit** is a scalable, high-performance, and 100% open-source feature flags management platform that empowers all teams to deliver, control, experiment with and monetize their software.


![featbit-readme-new-2](https://user-images.githubusercontent.com/68597908/211645725-391777fa-b5c0-4a0c-88e9-df9f05af9c61.gif)



## Introduction

Feature flag is a modern engineering technology that decouples code deployments from feature releases, giving you control over when and which end-users see which features. FeatBit enables teams to use feature flags on a massive scale across various use cases, such as: 

- Shipping software safer and faster by progressively rolling out features to target users without redeployment.
- Measuring the impact of features’ rollouts and running A/B tests to improve feature quality.
- Giving Sales, CS, and Marketing the ability to fine-tune target audiences and manage customer entitlement.

[Click here to get more information about FeatBit](https://featbit.medium.com/introducing-featbit-e0cef61572a).

## Getting Started

Clone the repository to your server or local machine and boot up the services.
```
git clone https://github.com/featbit/featbit
cd featbit
docker compose up -d
```
Once all containers have started, go to FeatBit's portal [http://localhost:8081](http://localhost:8081) and use the default credentials to log in.
- username: **test@featbit.com**
- password: **123456**

**Attention** : with the default configuration, the UI is accessible only from the local machine (on which you have run docker compose), please read [the doc](https://featbit.gitbook.io/docs/installation#attention) to make it accessible publicly.

[**Quick overview (Video)**](https://www.youtube.com/watch?v=hfww1FpjHV0) - give you a quick overview of FeatBit.

[**Getting Started (Docs)**](https://featbit.gitbook.io/docs/installation) - try FeatBit with an easy "getting started" guidance.

## Docs & Community

[**Documentation**](https://featbit.gitbook.io/docs/installation) - show you how to install/update FeatBit with Docker.

[**Slack Channel**](https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ) - An online support channel that helps you to quickly solve the problem.

[Community Forum](https://github.com/featbit/featbit/discussions/34) - where you can request new features, ask questions, show-n-tell, etc.

[Architecture](https://featbit.gitbook.io/docs/tech-stack/architecture) - an architecture overview of FeatBit system.

[Benchmark](https://featbit.gitbook.io/docs/tech-stack/benchmark) - the performance report of FeatBit running in non-cluster mode.

## Contribute to FeatBit

Building FeatBit is a collaborative effort, and we owe much gratitude to many intelligent and talented individuals. 

[**Join Slack to get your assignment**](https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ) . 

## Why FeatBit

The top 1% of companies spend thousands of hours building their own feature management platforms in-house. The other 99% are left paying for expensive 3rd party SaaS tools or hacking together unmaintained open source libraries.

We want to give all companies the flexibility and power of a fully-featured in-house feature management platform without needing to build it themselves.

## License

FeatBit is under the MIT license. See the [LICENSE](https://github.com/featbit/featbit/blob/main/LICENSE) file for details.


