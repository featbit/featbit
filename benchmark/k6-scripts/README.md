# Load tests
To better masure the performance of FeatBit, we have done and will continue to do a series of tests，we currently have conducted a load test against Evaluation Server as it is the bottleneck of the whole system. You will find following how to run the load test in AWS EC2 instances.


# Run Evaluation Server
To better mesure the capacity of Evaluation Server, we have refactored the code to be able to run it as a standalone service, all other services like Kafka, Redis etc are mocked. The service is running on the following EC2 instance:

- Type: t2.micro 1 vCPU + 1 G (x86)
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

The .NET SDK allows you to develop apps with .NET. If you install the .NET SDK, you don't need to install the corresponding runtime. To install the .NET SDK, run the following commands:
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
- Copy the output from previous step to ec2 instance
- On ec2 instancem cd into the folder and run: 
    ```bash
    dotnet Api.dll --environment IntegrationTests --urls "http://*:5000"
    ```
- Check the healthness with
    ```bash
    curl http://localhost:5100/health/liveness
    ```
- Monitor resource usage with the **top** command


# Run K6 tests
To minimize the network impact to the results, the K6 tests are run another EC2 instance in the same VPC.
- Type: c6i.8xlarge 32 CPU + 64G Memory
- Unbuntu: 20.04

SSH into the instance and do the following to run the tests
- Open **plan.js** and replace of value of **urlBase** with
```javascript
const urlBase = "ws://EVALUATION_SERVER_EC2_INSTANCE_PUBLISH_URL:5000"
```
- Install k6 with: **sudo snap install k6**
- Copy utils.js, k6-reporter.js and plan.js (you can find them in the current folder) to the instance
- Run k6 tests，you can change the value of **THROUGHPUT** to get the limit of the instance
    ```bash
    run -e THROUGHPUT=1000 plan.js
    ```
- When the tests are finished, the following files would be generated: summary.[throughtput]_[iteration].html and summary.[throughtput]_[iteration].json, they are representing the same results with different format.
- Do multiple tests and copy the output to local machine under the folder **bechmark/k6-scripts/test-results/results**
- Run result_extractor.js with **node run result_extractor.js**, it would extract all the results to a csv file with name **summary.csv**.

# NB
On your EC2 instance running Evluation Server, make sure the port 5000 is visible to the K6 instance