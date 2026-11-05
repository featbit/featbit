<div align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="modules/front-end/public/assets/featbit-logo-dark.svg">
    <source media="(prefers-color-scheme: light)" srcset="modules/front-end/public/assets/featbit-logo.svg">
    <img alt="FeatBit" src="modules/front-end/public/assets/featbit-logo.svg" width="64">
  </picture>
  <h1>FeatBit</h1>
</div>

We code faster with AI. More code, more features—**but also more bugs**. Work gets harder, with more pressure and unpredictable overtime. Customer churn and financial losses become harder to control.

So we hesitate to move at AI speed, and fall behind the competition.

FeatBit helps you manage that risk. Roll out features gradually, monitor their technical and business impact, and roll back problematic features immediately when something goes wrong.

For more information, visit [www.featbit.co](https://www.featbit.co).

![FeatBit release control: production monitoring, targeted rollouts, instant rollback, Bayesian A/B testing, and AI agent workflows](.github/assets/featbit-release-control.png)

## Get started in 3 steps

> [!NOTE]
> Prefer a hosted service? [Use FeatBit Cloud](https://app.featbit.co) without managing infrastructure.

To try FeatBit on your machine, follow the steps below. You'll need Git and Docker with Docker Compose.

### 1. Start FeatBit

```bash
git clone --branch 6.1.0 --depth 1 https://github.com/featbit/featbit.git
cd featbit
docker compose up -d
```

Once the containers have started, open [http://localhost:8081](http://localhost:8081) and sign in with the default credentials:

- Username: **test@featbit.com**
- Password: **123456**

### 2. Connect an SDK

Choose an [official SDK](https://docs.featbit.co/sdk/overview) for your application. Follow the portal's getting-started guide to initialize it with your environment's SDK key and connection URLs.

Once your SDK is connected, you're ready to evaluate your first feature flag.

### 3. Try your first feature flag

In the portal, create a boolean flag named "Use New Algorithm" with an automatically generated key of `use-new-algorithm`.

Use your SDK to evaluate the flag by its key and choose which code to run. For example, with the .NET SDK:

```csharp
var user = FbUser.Builder("tester-id").Name("tester").Build();
if (featbit.BoolVariation("use-new-algorithm", user, defaultValue: false))
{
    // Run the new algorithm.
}
else
{
    // Run the existing algorithm.
}
```

In the portal, turn the flag on for a small group of users to try the new algorithm, then gradually expand the rollout. If needed, turn the flag off to switch back to the existing algorithm.

## Self-host FeatBit

Run FeatBit on your own infrastructure, on-premises or in the cloud. Choose the setup that fits your environment:

- **Kubernetes**: deploy with the official [Helm charts](https://github.com/featbit/featbit-charts) or the [manifest files](kubernetes).
- **AWS**: deploy with [FeatBit's Terraform project](https://github.com/featbit/featbit-terraform-aws).
- **Azure Container Apps**: deploy with [FeatBit's Terraform project](https://github.com/featbit/azure-container-apps).
- **Microsoft Aspire**: deploy to Azure Container Apps with [FeatBit Aspire](https://github.com/featbit/featbit-aspire).
- **Docker Compose**: follow the [self-hosting guide](https://docs.featbit.co/installation/docker-compose) to run FeatBit and its dependencies.

## Contribute

Contributions to code, SDKs, documentation, and bug reports are welcome. Read the [contributing guide](CONTRIBUTING.md) to get started, browse [open issues](https://github.com/featbit/featbit/issues), or join the community on [Discord](https://discord.gg/h9dVMsQH).

## License

FeatBit is an Open Core product. Most of its code is available under the [MIT license](LICENSE).

Certain features require a valid license key. See the [license documentation](https://docs.featbit.co/licenses/overview) for details.
