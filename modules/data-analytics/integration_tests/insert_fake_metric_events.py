from random import randint

import requests

url = "http://127.0.0.1/api/events"

for group in range(1, 5):
    events = []
    weight = randint(10, 2000)
    size = 10000 - weight * group
    for user in range(size):
        numeric_value = randint(1, 50)
        Q5 = {
            "Route": "index",
            "Type": "CustomEvent",
            "EventName": "ButtonPayTrack",
            "NumericValue": numeric_value,
            "User": {
                    "FFUserName": "u_group" + str(group) + "_" + str(user),
                    "FFUserEmail": "u_group" + str(group) + "_" + str(user) + "@testliang.com",
                    "FFUserCountry": "China",
                    "FFUserKeyId": "u_group" + str(group) + "_" + str(user) + "@testliang.com",
                    "FFUserCustomizedProperties": [
                        {
                            "Name": "age",
                            "Value": "16"
                        }
                    ]
            },
            "ApplicationType": "Javascript",
            "CustomizedProperties": [
                {
                    "Name": "age",
                    "Value": "16"
                }
            ],
            "ProjectId": "48",
            "EnvironmentId": "103",
            "AccountId": "38",
            "tag_0": "u_group" + str(group) + "_" + str(user) + "@testliang.com",
            "tag_1": str(numeric_value)
        }
        events.append(Q5)
    response = requests.post(url, json=events)
    print(f"{response.status_code} - insert {size} user events")

print('FINISH')
