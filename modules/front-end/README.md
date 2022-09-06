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
[![GitHub Workflow Status](https://img.shields.io/github/workflow/status/featbit/featbit/FeatBit%20UI)](https://github.com/featbit/featbit/actions/workflows/ui-build.yml?branch=main)

</div>

FeatBit includes a customer UI/Portal. It is optional to install, but we highly recommend using it as the management portal.

The FeatBit UI provides features for managing and updating properties, rollout, rollback, configuration peer reviews, permission management, audit logs, and many other features.

# Getting Started

## Installing UI Independently with a Docker Image
You can install and run UI with a Docker image. To run, binding the exposed port 80 or any other available port, use:
```
docker build -t featbit/ui .
docker run -d -p 80:80 --name featbit-ui featbit/ui 
```

When you put http://localhost in your browser, by default, the UI will redirect to the language defined by **accept-language** of the request headers,
you can manually switch the language with the language switcher in the UI.
