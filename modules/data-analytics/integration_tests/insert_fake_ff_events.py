import requests

url = "http://127.0.0.1/api/events"

for group in range(1, 5):
    events = []
    for t in range(5):
        low = t * 10000
        high = (t + 1) * 10000
        for user in range(low, high):
            Q4 = {
                "RequestPath": "index/paypage",
                "FeatureFlagId": "FF__38__48__103__PayButton",
                "EnvId": "103",
                "AccountId": "38",
                "ProjectId": "48",
                "FeatureFlagKeyName": "PayButton",
                "UserKeyId": "u_group" + str(group) + "_" + str(user) + "@testliang.com",
                "FFUserName": "u_group" + str(group) + "_" + str(user),
                "VariationLocalId": str(group),
                "tag_0": "u_group" + str(group) + "_" + str(user) + "@testliang.com",
                "tag_1": str(group)
            }
            events.append(Q4)
        print("sending request")
        response = requests.post(url, json=events)
        print(f"{response.status_code} - insert 10000 flag events")

print('FINISH')
