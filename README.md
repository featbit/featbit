

<div align="center">

<img src="https://user-images.githubusercontent.com/68597908/206148625-43f14f58-f3c0-4042-82a0-9f9421c270fa.png" width="288" > 


<h3 align="center"><a href="https://medium.com/p/e0cef61572a">Feature management, for all teams</a></h3>


<p>
A scalable and high-performance platform for Feature Flags & Experimentations that empowers
<br/>
 all teams to deliver, control, experiment with and monetize their software.
</p>

<!--
Make New Badge Pattern badges inline
See https://github.com/all-?/all-contributors/issues/361#issuecomment-637166066
-->

[![stars](https://img.shields.io/github/stars/featbit/featbit.svg?style=flat&logo=github&colorB=red&label=stars)](https://github.com/featbit/featbit)                   [![License](https://img.shields.io/static/v1?label=license&message=MIT&color=brightgreen)](https://github.com/featbit/featbit/blob/main/LICENSE)
[![](https://img.shields.io/badge/.NET-%3E=6.0-6E359E?logo=csharp&logoColor=white)](https://dotnet.microsoft.com/)
[![](https://img.shields.io/badge/Python-%3E=3.9-FFDD53?logo=python&logoColor=white)](https://www.python.org/)
[![Angular](https://img.shields.io/badge/Angular-14.0-DD0031?logo=angular&logoColor=white)](https://angular.io/)                                                      


<p>
    <a href="https://featbit.medium.com/introducing-featbit-e0cef61572a"><img src="https://img.shields.io/badge/-Medium-red?style=social&logo=medium" height=23></a>   
    &nbsp;
    <a href="https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ"><img src="https://img.shields.io/badge/slack-join-3CC798?style=social&logo=slack" height=23></a>
    &nbsp;
    <a href="https://twitter.com/RealFeatBit"><img src="https://img.shields.io/badge/-Twitter-red?style=social&logo=twitter" height=23></a>
    &nbsp;
    <a href="https://twitter.com/intent/tweet?text=A%20scalable%2C%20high-performance%2C%20and%20open-source%20Feature%20Management%20platform%20that%20empowers%20all%20teams%20to%20deliver%2C%20control%2C%20monetize%2C%20and%20experiment%20with%20their%20software%20at%20https%3A%2F%2Fgithub.com%2Ffeatbit%2Ffeatbit%0A%0A&hashtags=featureflags,dotnet,opensource,featureflag,featuremanagement&via=RealFeatBit"><img src="https://img.shields.io/twitter/url/http/shields.io.svg?style=social" height=23></a>
</p>


<h3 align="center">
  <a href="https://featbit.gitbook.io/docs/installation">Installation</a>
  <span> · </span>
  <a href="https://featbit.gitbook.io/">Getting Started</a>
  <span> · </span>
  <a href="https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ">Online Support</a>
  <span> · </span>
  <a href="https://featbit.gitbook.io/">Documentation</a>  
  <span> · </span>
  <a href="https://github.com/featbit/featbit/discussions/categories/announcements">Milestones</a>
</h3>
</div>


--------------------------------------------------

![featbit-readme-new-2](https://user-images.githubusercontent.com/68597908/205070601-bd35f8e8-6765-49e7-8d85-88364be9934b.gif)

--------------------------------------------------

## Introduction

**FeatBit** provides a holistic framework for Feature Flag-driven development, A/B testing, and experimentation, enabling teams to use flags on a massive scale across various use cases. FeatBit empowers all teams:

-	Reduce delivery risk by progressively releasing features to targeting users without redeployment.

-	Measure the impact of features’ rollouts and run A/B tests to improve feature quality.

-	Enable Sales and CS to close more deals with demos and feature trials at the push of a button.

-	Give Marketing the ability to fine-tune target audiences, manage customer programs, etc.

-	Etc.


[**Click here to get more use cases about FeatBit and why FeatBit.**](https://featbit.medium.com/introducing-featbit-e0cef61572a)







## Getting Started

You can launch all the docker containers by docker compose, all the images are available on [docker hub](https://hub.docker.com/u/featbit).

Before launching FeatBit, make sure you have git and docker installed. Then do the following steps:

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

## Documentation & Communities

◆ To learn how to use FeatBit, you can visit [**FeatBit's documentation page**](https://featbit.gitbook.io/docs/)

◆ If you met issues, you can report it to our [**Issues page**](https://github.com/featbit/featbit/issues)

◆ If you want to request a new feature, you can post it on our [**Discussion's feature suggestions page**](https://github.com/featbit/featbit/discussions/categories/feature-suggestions)

◆ All important announcements will be posted on our [**Discusssion announcement page**](https://github.com/featbit/featbit/discussions/categories/announcements). It includes information like release, milestones, roadmap, thanks, reward, etc.

◆ Any other requirements (such as Q&A, pool, show-n-tell, general topics), you can join our [**Discussions's page**](https://github.com/featbit/featbit/discussions) .

◆ If you have further questions and want to contact us, you can join [**FeatBit Slack Channel**](https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ) .  

◆ All approved stories and tasks will be displayed and managed in [**GitHub's project page**](https://github.com/orgs/featbit/projects).


## Other useful links

◆  [Release Notes](https://github.com/featbit/featbit/releases) - Find out what changes we are making and how we are improving FeatBit.

◆  [Code of conduct](https://github.com/featbit/featbit/blob/main/code_of_conduct.md) - How we promote and maintain a harassment-free experience for everyone in our community.

## Tech Stack

◆  [Architecture](https://featbit.gitbook.io/docs/tech-stack/architecture) - Architecture of FeatBit.

◆  [Benchmark](https://featbit.gitbook.io/docs/tech-stack/benchmark) - More detailed reports on FeatBit's benchmark test. 


## Contribute to FeatBit

Building FeatBit is a collaborative effort, and we owe much gratitude to many intelligent and talented individuals. Building it together with the community ensures that we make a product that solves real problems for real people. 

We'd love to have your help too. Feel free to open issues, providing pull requests, and become a contributor.

[![Design](https://contribute.design/api/shield/featbit/featbit)](https://contribute.design/featbit/featbit)

## License

FeatBit is under the MIT license. See the [LICENSE](https://github.com/featbit/featbit/blob/main/LICENSE) file for details.
