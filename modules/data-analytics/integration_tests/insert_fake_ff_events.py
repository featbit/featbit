import requests

url = "http://127.0.0.1:8200/api/events"

for group in range(1, 5):
    events = []
    for t in range(5):
        low = t * 10000
        high = (t + 1) * 10000
        for user in range(low, high):
            Q4 = {
                "route": "/Variation/GetMultiOptionVariation",
                "flagId": "FF__38__48__103__PayButton",
                "envId": "103",
                "accountId": "38",
                "projectId": "48",
                "featureFlagKey": "PayButton",
                "sendToExperiment": True,
                "userKeyId": "u_group" + str(group) + "_" + str(user) + "@testliang.com",
                "userName": "u_group" + str(group) + "_" + str(user),
                "variationId": str(group),
                "tag_0": "u_group" + str(group) + "_" + str(user) + "@testliang.com",
                "tag_1": str(group),
                "tag_2": True
            }
            events.append(Q4)
        print("sending request")
        response = requests.post(url, json=events)
        print(f"{response.status_code} - insert 10000 flag events")

print('FINISH')
