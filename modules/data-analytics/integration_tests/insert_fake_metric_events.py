from random import randint

import requests

url = "http://127.0.0.1:5000/api/events"

for group in range(1, 5):
    events = []
    weight = randint(10, 2000)
    size = 10000 - weight * group
    for user in range(size):
        numeric_value = randint(1, 50)
        Q5 = {
            "route": "index",
            "type": "CustomEvent",
            "eventName": "ButtonPayTrack",
            "numericValue": numeric_value,
            "user": {
                    "name": "u_group" + str(group) + "_" + str(user),
                    "keyId": "u_group" + str(group) + "_" + str(user) + "@testliang.com",
                    "customizedProperties": [
                        {
                            "name": "age",
                            "value": "16"
                        }
                    ]
            },
            "applicationType": "Javascript",
            "projectId": "48",
            "envId": "103",
            "accountId": "38",
            "tag_0": "u_group" + str(group) + "_" + str(user) + "@testliang.com",
            "tag_1": str(numeric_value),
            "tag_2": "u_group" + str(group) + "_" + str(user),
        }
        events.append(Q5)
    response = requests.post(url, json=events)
    print(f"{response.status_code} - insert {size} user events")

print('FINISH')
