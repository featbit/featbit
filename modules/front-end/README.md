<h1 align="center">
FeatBit UI
</h1>

<div align="center">

<!--
Make New Badge Pattern badges inline
See https://github.com/all-?/all-contributors/issues/361#issuecomment-637166066
-->

[![stars](https://img.shields.io/github/stars/featbit/featbit.svg?style=flat&logo=github&colorB=red&label=stars)](https://github.com/featbit/featbit)
[![Node](https://img.shields.io/badge/node->=16.0-success?logo=node.js&logoColor=white)](https://www.typescriptlang.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-4.7-3178c6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Angular](https://img.shields.io/badge/Angular-14.0-DD0031?logo=angular&logoColor=white)](https://angular.io/)
[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/featbit/featbit/FeatBit%20UI%20change%20validations)](https://github.com/featbit/featbit/actions/workflows/ui-change-validations.yml?branch=main)

</div>

FeatBit includes a customer UI/Portal. You can use it as the management portal.

The FeatBit UI provides features for managing and updating feature flags, users, rollback, configuration peer reviews, permission management, organization management, audit logs, and many other features.

# Getting Started

Usually, you should run UI along with all other services by running in the root of the repository :
```
docker compose -f ./docker-compse.yml up -d
```
The UI would be available at http://localhost:8081

## Run locally with development mode
If you already have the API server, Evaluation server and Data analytics server running somewhere, and you want to launch UI on a different machine or want to do some development work on UI,
you can run the UI locally. Open the file [environment.ts](src/environments/environment.ts), and fill the variables like this:
```ts
export const environment = {
  production: false,
  url: 'http://localhost:5000',
  demoUrl: 'https://featbit-samples.vercel.app',
  evaluationUrl: 'http:localhost:5100'
};
```
Assuming you are running other service on the same machine:
- **url**: the url of the API server
- **demoUrl**: the url of the dino-game demo, it should be running somewhere
- **evaluationUrl**: the url of the evaluation server

Then run
```
npm run start
```

The UI would be available at http://localhost:4200

## Install with Docker

Three variables could be override by environment variables when running the container:
- **API_URL**: the url of the API Server, default value is http://localhost:5000, it overrides **url**
- **DEMO_URL**: set the value if you deploy the [dino-game demo](https://github.com/featbit/featbit-samples/tree/main/samples/dino-game/interactive-demo-vue) on your own server, otherwise it would use our demo deployed on https://featbit-samples.vercel.app. The link doesn't work if you click directly on it, it needs extra parameters. **demoUrl**
- **EVALUATION_URL**: the url of the evaluation server, this is used by the demo, ignore it if you don't want to run the demo, the default value is http://localhost:5100. It overrides **evaluationUrl**

Bind the port 8081 or any other available port to 80.

### Build docker image and run container from the source code
```
docker build -t featbit/ui .
docker run -d -p 8081:80 -e API_URL="http://localhost:5000" -e DEMO_URL="https://featbit-samples.vercel.app" -e EVALUATION_URL="http://localhost:5100" --name featbit-ui featbit/ui
```

### Run docker container from our prebuilt docker hub image
```
docker run -d -p 8081:80 -e API_URL="http://localhost:5000" -e DEMO_URL="https://featbit-samples.vercel.app" -e EVALUATION_URL="http://localhost:5100" --name featbit-ui featbitdocker/featbit-ui:latest
```

Then go to http://localhost:8081

### Switch UI language

When you put http://localhost:8081 in your browser, by default, the UI will redirect to the language defined by **accept-language** of the request headers,
you can manually switch the language with the language switcher in the UI.

As **ng serve** only support one single locale, during development, the locale-switcher component doesn't work. If you want to check different language,
run the app with one of the following
```
npm run start:en // English, available at localhost:4200
npm run start:zh // Chinese, available at localhost:4201
```
