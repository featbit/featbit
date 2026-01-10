# Introduction

Welcome to the FeatBit development documentation! This guide will walk you through setting up your development
environment, connecting to our code base, and submitting code to the project.

# Get Started

FeatBit consists of multiple services, to learn more about the architecture, please read
our [documentation](https://docs.featbit.co/tech-stack/overview).

![Architecture](https://docs.featbit.co/_next/static/media/architecture-overview.25fdb1db.svg)

To get started, we need to clone FeatBit's repository first.

```bash
git clone https://github.com/featbit/featbit
```

Most of the contribution work will focus on UI and API, we just need to set up their dependencies via docker compose and
launch these two services from the code.

## Setup dependencies

You can setup infrastructure dependencies using the `/docker/composes/docker-compose-infra.yml` file, for example

```bash
cd featbit

# start postgresql and redis
docker compose --project-directory . -f ./docker/composes/docker-compose-infra.yml up -d redis postgresql
```

## Run API

The API project is built with [.NET 8](https://dotnet.microsoft.com/en-us/download/dotnet/8.0), make sure you have the
latest .NET 8.0 SDK installed before you start.

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
want to check a different language, run the app with one of the following command

```
npm run start // English, available at localhost:4200
npm run start:zh // Chinese, available at localhost:4201
```

### Serve UI under a path

Instead of serving the UI directly at the domain root, you may need to serve it under a specific path, for example `http://localhost:4200/abc/def/`.

#### Development Mode

For local development, use the **start:base-href** command:

```bash
npm run start:base-href
```

This command is defined in `package.json` as:
```json
"start:base-href": "ng serve --serve-path /abc/def/ --configuration=development --port=4200"
```

**Important:** You must also update the `<base href>` tag in [index.html](./modules/front-end/src/index.html):

```html
<!-- Change from: -->
<base href="/">

<!-- To: -->
<base href="/abc/def/">
```

You can replace `/abc/def/` with your own path in both the npm script and the index.html file.

#### Production Mode (Docker)

When running the UI in a Docker container, set the `BASE_HREF` environment variable in docker-compose.yml:

```yaml
services:
  ui:
    image: featbit/ui:latest
    environment:
      - BASE_HREF=/abc/def/
```

The Docker entrypoint script will automatically configure nginx and update all locale-specific index.html files with the correct base href.


### Internationalization

FeatBit should be available to everyone everywhere, and we don't want language to be a barrier. So for this reason we
have implemented internationalization features into our codebase.

FeatBit UI uses official [@angular/localize
](https://www.npmjs.com/package/@angular/localize) package to implement the i18n, please read
the [official doc](https://angular.io/guide/i18n-overview) for how to use it. The language resource files are under *
*modules/front-end/src/locale** folder, with following format messages.xx.xlf, xx is the language code.

Currently only English and Chinese are available, we would be very grateful to have contributors for other languages
too.

If you put a text in the UI, at the end of the developing work, you need to put its translations into the corresponding
resource file. This work could be very tedious, we created
a [library](https://github.com/featbit/angular-locales-generator) to facilitate the job, you need to run the command

```bash
npm run i18n
```

English would be generated automatically in messages.xlf, you just need to put the translations into message.xx.xlf. A
small trick is to search this text `<target></target>` in the file and put the translation between **target** tag.

