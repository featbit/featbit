# DATA-ANALYTICS is an open source online analytical component, built for FeatBit

* Deploy on your own infrastructure to keep control of your data.
* Track every event on your website or app
* Understand your users and how to improve your product via A/B/N test

## Build & Run on local

**DATA-ANALYTICS** depends on other services like: zookeeper, clickhouse, kafka, redis, evaluation-server and UI.

We recommend you to run it via:

```
git clone https://github.com/featbit/featbit.git

cd featbit/

# run on prod
docker compose up -d

# run on dev
docker-compose -f docker-compose-dev.yml up -d      

```
