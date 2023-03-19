# Load Tests

In order to better measure the performance of FeatBit, we have carried out and will continue to carry out a series of
tests. We have currently carried out a load test against the evaluation server, as it is the bottleneck of the whole
system. Below is how we run the load test on AWS EC2 instances.

# Prerequisite

To better measure the capacity of the evaluation server, we have refactored the code to run as a standalone service. All
its dependencies like Kafka, Redis etc. are mocked. The service runs on the following EC2 instance.

- Type: AWS t2.micro 1 vCPU + 1 G (x86)
- Ubuntu: 20.04

After the EC2 instance is successfully started and running, clone the [featbit repo](https://github.com/featbit/featbit)
to this EC2 instance:

```bash
git clone https://github.com/featbit/featbit
```

## Install .NET SDK

Open a terminal and run the following commands:

```bash
wget https://packages.microsoft.com/config/ubuntu/20.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
rm packages-microsoft-prod.deb
```

The .NET SDK allows you to develop apps with .NET. If you install the .NET 6.0 SDK, you don't need to install the
corresponding runtime. To install the .NET SDK, run the following commands:

```bash
sudo apt-get update && sudo apt-get install -y dotnet-sdk-6.0
```

## Run Evaluation Server

Go to the Api folder **modules/evaluation-server/src/Api**

- Publish

```bash
dotnet publish --framework net6.0 --self-contained false --runtime linux-x64 --output publish
```

- Run

```bash
cd publish
dotnet Api.dll --environment IntegrationTests --urls "http://*:5000"
```

- Health check

```bash
curl http://localhost:5000/health/liveness
```

- Monitor resource usage with the **top** command

# Run K6 tests

To minimise the network impact on the results, the K6 tests are run on another EC2 instance in the same VPC.

- Type: c6i.8xlarge 32 CPU + 64G memory
- Ubuntu: 20.04

SSH into the instance and do the following to run the tests

- Clone featbit repo `git clone https://github.com/featbit/featbit` to this EC2 instance
- Install k6 `sudo snap install k6`
- Install nodejs `sudo apt install nodejs`
- Open **benchmark/k6-scripts/plan.js** and update the value of **urlBase** with

```javascript
const urlBase = "ws://evaluation-server-ec2-instance-public-address:5000"
```

- Go to the k6 scripts folder `cd benchmark/k6-scripts`
- Run k6 tests, you can change the value of **THROUGHPUT** to get the limit of the instance

```bash
k6 run -e THROUGHPUT=1000 plan.js
```

- When the tests are finished, the following files would be generated: summary.{throughput}\_{iteration}.html and
  summary.{throughtput}\_{iteration}.json, representing the same results in a different format.
- Run several tests and copy the output to the **benchmark/k6-scripts/test-results/results** folder.
- Run `node run result_extractor.js`, it would extract all results into a csv file named **summary.csv**.

# Note

On the EC2 instance running Evaluation Server, make sure that port 5000 is available to the K6 EC2 instance.

In the tests above, we used 5 feature flags and 2 segments. You can find them here:

- [flags.json](https://github.com/featbit/featbit/tree/main/modules/evaluation-server/src/Infrastructure/Fakes/flags.json) 
- [segments.json](https://github.com/featbit/featbit/tree/main/modules/evaluation-server/src/Infrastructure/Fakes/segments.json) 
