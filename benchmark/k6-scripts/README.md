# Load Tests

In order to better measure the performance of FeatBit, we have carried out and will continue to carry out a series of tests，we have currently carried out a load test against the evaluation server, as it is the bottleneck of the whole system. Below is how to run the load test on AWS EC2 instances.


# Run Evaluation Server

To better measure the capacity of the evaluation server, we have refactored the code to run as a standalone service. All other services like Kafka, Redis etc. are mocked. The service runs on the following EC2 instance:

- Type: AWS t2.micro 1 vCPU + 1 G (x86)
- Unbuntu: 20.04

## Intall Evaluation Server on EC2 instance
After the EC2 instance is successfully started and running:

### Install .Net SDK: 
Open a terminal and run the following commands:
```bash
wget https://packages.microsoft.com/config/ubuntu/20.04/packages-microsoft-prod.deb -O packages-microsoft-prod.deb
sudo dpkg -i packages-microsoft-prod.deb
rm packages-microsoft-prod.deb
```

The .NET SDK allows you to develop apps with .NET. If you install the .NET 6.0 SDK, you don't need to install the corresponding runtime. To install the .NET SDK, run the following commands:
```bash
sudo apt-get update && sudo apt-get install -y dotnet-sdk-6.0
```

### Publish Evaluation Server with local machine

Go to Api folder **modules\evaluation-server\src\Api**

- To publish to win64 platform:
    ```bash
    dotnet publish --framework net6.0 --self-contained false --runtime win-x64 --output DEST_PATH
    ```

- To publish to linux64 platform
    ```bash
    dotnet publish --framework net6.0 --self-contained false --runtime linux-x64 --output DEST_PATH
    ```

### Run Evaluation Server on EC2 instance

- Copy the output of the previous step to the EC2 instance
- On the EC2 instance, cd into the folder and run: 
    ```bash
    dotnet Api.dll --environment IntegrationTests --urls "http://*:5000"
    ```
- Check the health with
    ```bash
    curl http://localhost:5100/health/liveness
    ```
- Monitor resource usage with the **top** command


# Run K6 tests

To minimise the network impact on the results, the K6 tests are run on another EC2 instance in the same VPC.

- Type: c6i.8xlarge 32 CPU + 64G memory
- Unbuntu: 20.04

SSH into the instance and do the following to run the tests
- Open **plan.js** and replace the value of **urlBase** with
```javascript
const urlBase = "ws://EVALUATION_SERVER_EC2_INSTANCE_PUBLISH_URL:5000"
```
- Install k6 with: **sudo snap install k6**
- Copy utils.js, k6-reporter.js and plan.js (you can find them in the current folder) to the instance
- Run k6 tests，you can change the value of **THROUGHPUT** to get the limit of the instance
    ```bash
    run -e THROUGHPUT=1000 plan.js
    ```

- When the tests are finished, the following files would be generated: summary.[throughtput]_[iteration].html and summary.[throughtput]_[iteration].json, representing the same results in a different format.
- Run several tests and copy the output to the **bechmark/k6-scripts/test-results/results** folder on your local machine.
- Run result_extractor.js with **node run result_extractor.js**, it would extract all results into a csv file named **summary.csv**.

# NB

On your EC2 instance running Evaluation Server, make sure that port 5000 is visible to the K6 instance.