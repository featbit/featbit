# Contributions

Welcome to the Featbit software development documentation.

Here you will find all the resources you need to start developing your Featbit project.

This document will guide you through the stages of setting up your development environment, connecting to our code base and finally submitting code to the project!

# Setting up the environment

Featbit consists of multiple services, to understand the architecture, please read this [document](https://featbit.gitbook.io/docs/tech-stack/architecture).

![Architecture](https://2887964115-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FWMA5plqGXLhCIDCINvoc%2Fuploads%2Fn8WleMePXy4BW6b0qQq2%2Fimage.png?alt=media&token=27fd5b0e-e704-4e01-b084-b8f5399f2565)

However, to make contributions, you don't need to launch each service manually. Most of the contribution work would focus on UI and API, you just need to launch those two services and all the other services could be launched by docker compose.

## Launch docker compose
Open [docker-compose.yml](./docker-compose.yml) and comment out **UI** and **api-server** under services, they are the first two services. Then do

```bash
docker compose up -d
```

Wait until all services are successfully launched, then you will be ready to set up API and UI.

## Setting up API locally

## Setting up UI locally

The UI is built uppon [Angular](https://angular.io/) and [NG-ZORRO](https://ng.ant.design/docs/introduce/en), please refer to their docs for more details.

Navigate to **modules/front-end** folder and do the following commands:

```bash
npm install
npm run start
```

The UI would be available at [http://localhost:4200](http://localhost:4200). 

The above process would launch the UI in English language.

As **ng serve** only supports one single locale, during development, the locale-switcher component doesn't work. If you want to check a different language,
run the app with one of the following
```
npm run start // English, available at localhost:4200
npm run start:zh // Chinese, available at localhost:4201
```

#### Internationalization

Featbit should be available to everyone everywhere, and we don't want language to be a barrier. So for this reason we have implemented internationalization features into our codebase.

Featbit UI uses offical [@angular/localize
](https://www.npmjs.com/package/@angular/localize) package to implement the i18n, please read the [official doc](https://angular.io/guide/i18n-overview) for how to use it. The language resource files are under **modules/front-end/src/locale** folder, with following format messages.xx.xlf, xx is the language code.

Currently only English and Chinese are available, we would be very grateful to have contributors for other languages too.

If you put a text in the UI, at the end of the developing work, you need to put its translations into the corresponding resource file. This work could be very tedius, we created a [library](https://github.com/featbit/angular-locales-generator) to faciliate the job, you need to run the command

```bash
npm run i18n
```

English would be generated automatically in messages.xlf, you just need to put the translations into message.xx.xlf. A small trick is to search this text ```<target></target>``` in the file and put the translation between **target** tag.

