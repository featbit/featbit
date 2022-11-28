
<div align="center">

<h1 style="border-bottom: none">
    <b>FeatBit - </b>
    Evolution to BizDevOps
    <br>
</h1>

**FeatBit** is a scalable and high-performance **Feature Management** platform. FeatBit's mission is to Empower all teams to deliver, control, experiment with, and monetize their software. ([More about FeatBit](/what_is_featbit.md) & [Why FeatBit](/why_featbit.md))


</div>

<div align="center">
<!--
Make New Badge Pattern badges inline
See https://github.com/all-?/all-contributors/issues/361#issuecomment-637166066
-->

[![stars](https://img.shields.io/github/stars/featbit/featbit.svg?style=flat&logo=github&colorB=red&label=stars)](https://github.com/featbit/featbit)                   [![License](https://img.shields.io/static/v1?label=license&message=MIT&color=brightgreen)](https://github.com/featbit/featbit/blob/main/LICENSE)
[![](https://img.shields.io/badge/.NET-%3E=6.0-6E359E?logo=csharp&logoColor=white)](https://dotnet.microsoft.com/)
[![](https://img.shields.io/badge/Python-%3E=3.9-FFDD53?logo=python&logoColor=white)](https://www.python.org/)
[![Angular](https://img.shields.io/badge/Angular-14.0-DD0031?logo=angular&logoColor=white)](https://angular.io/)
[![slack-community](https://img.shields.io/badge/slack-join-3CC798?style=social&logo=slack)](https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ)  

</div>

<p align="center">
  <a href="#getting-started">Getting Started</a> •
  <a href="#documentation--communities">Docs & Communities</a> •
  <a href="#other-useful-links">Architecture</a> •
  <a href="#contribute-to-featbit">Contribution</a> •
  <a href="#licenset">License</a>
</p>

![featbit-readme4](https://user-images.githubusercontent.com/68597908/202688653-d9dbe87d-9c51-41f2-98f7-ded536459cbc.gif)

--------------------------------------------------

## Getting Started

You can launch all the docker containers by docker compose, all the images are available on [docker hub]().

Before launching FeatBit, make sure you have git and docker installed. Then do the following steps:

1. Clone the repository to your server or local machine and boot up the services. Change the ports defined in docker-compose.yml as needed
```
git clone https://github.com/featbit/featbit
cd featbit
docker compose up -d
```
    
2. Go to UI/Portal at [http://localhost:8081](http://localhost:8081) and use the default credentials to log in (Note that you should replace 8081 with your port number if you made any changes previously).

3. Remember to update the admin password after first connection.
    - username: **test@featbit.com**
    - password: **123456**

If you want to build the images and launch the containers from the source code, you can also do as follows:
```
git clone https://github.com/featbit/featbit
cd featbit
docker compose -f ./docker-compose-dev.yml up -d
```

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

## License

FeatBit is under the MIT license. See the [LICENSE](https://github.com/featbit/featbit/blob/main/LICENSE) file for details.
