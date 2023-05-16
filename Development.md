# Introduction

Welcome to the FeatBit development documentation! This guide will walk you through setting up your development
environment, connecting to our code base, and submitting code to the project.

# Get Started

FeatBit consists of multiple services, to learn more about the architecture, please read
our [documentation](https://featbit.gitbook.io/docs/tech-stack/architecture).

![Architecture](https://2887964115-files.gitbook.io/~/files/v0/b/gitbook-x-prod.appspot.com/o/spaces%2FWMA5plqGXLhCIDCINvoc%2Fuploads%2FELW411vbJvKbSu1uG2Z0%2Fimage.png?alt=media&token=4fff2e66-cbca-4c45-b8c0-8fc99d357d13)

To get started, we need to clone FeatBit's repository first.

```bash
git clone https://github.com/featbit/featbit
```

Most of the contribution work will focus on UI and API, we just need to set up their dependencies via docker compose and
launch these two services from the code.

## Setup dependencies

Open [docker-compose-dev.yml](./docker-compose-dev.yml) and **comment out ui and/or api-server service according to the
scope of your work**, they are the
first two services. Then do

```bash
docker compose -f docker-compose-dev.yml up -d
```

Wait until all services are successfully launched, and we're ready to run API and/or UI locally.

## Run API

The API project is built with [.NET 6](https://dotnet.microsoft.com/en-us/download/dotnet/6.0), make sure you have the
latest .NET 6.0 SDK installed before you start.

Navigate to **modules/back-end/src/Api** folder and run `dotnet run`, then the swagger should be available
at [http://localhost:5000/swagger](http://localhost:5000/swagger).

## Run UI

The UI is built with [Angular](https://angular.io/) and [NG-ZORRO](https://ng.ant.design/docs/introduce/en), please
refer to their docs for more details.

Navigate to **modules/front-end** folder and do the following commands:

```bash
npm install
npm run start
```

Then UI should be available at [http://localhost:4200](http://localhost:4200).

The above process would launch the UI in English language.

As **ng serve** only supports one single locale, during development, the locale-switcher component doesn't work. If you
want to check a different language,
run the app with one of the following

```
npm run start // English, available at localhost:4200
npm run start:zh // Chinese, available at localhost:4201
```

### Internationalization

FeatBit should be available to everyone everywhere, and we don't want language to be a barrier. So for this reason we
have implemented internationalization features into our codebase.

FeatBit UI uses offical [@angular/localize
](https://www.npmjs.com/package/@angular/localize) package to implement the i18n, please read
the [official doc](https://angular.io/guide/i18n-overview) for how to use it. The language resource files are under *
*modules/front-end/src/locale** folder, with following format messages.xx.xlf, xx is the language code.

Currently only English and Chinese are available, we would be very grateful to have contributors for other languages
too.

If you put a text in the UI, at the end of the developing work, you need to put its translations into the corresponding
resource file. This work could be very tedius, we created
a [library](https://github.com/featbit/angular-locales-generator) to faciliate the job, you need to run the command

```bash
npm run i18n
```

English would be generated automatically in messages.xlf, you just need to put the translations into message.xx.xlf. A
small trick is to search this text `<target></target>` in the file and put the translation between **target** tag.

