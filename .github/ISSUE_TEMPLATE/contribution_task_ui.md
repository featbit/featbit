# Description

# Scope

# Screenshot

# How to implement

1.
2.
3.
4.
5. `npm run i18n`

# Internationlization (i18n)
FeatBit supports i18n and uses the official [@angular/localize](https://www.npmjs.com/package/@angular/localize) package. See the [doc](https://angular.io/guide/i18n-overview) for more information. 

Resource files can be found in the [locale](../../modules/front-end/src/locale) folder:
- messages.xlf
- messages.zh.xlf
  
 we currently support English and Chinese languages. Whenever a label is added or changed by a PR, the resource files need to be regenerated, so at the end of your development you should run in terminal:

```bash
npm run i18n
```

Make sure the resource files are committed and pushed to your PR.

# Setup dev environment
The UI needs to work along with the backend. Even if the PR is only related to the UI, you still need to set up the backend. Do the following:

- Launch the whole APP with docker compose, the UI should be available at http://localhost:8081, but you can ignore it.
- Go to **modules\front-end** and run in terminal: `npm run start`
- When the previous step is done, open the UI in browser with the URL: http://localhost:4200 and follow the guid to initialize the APP

# Contribution points

Each contribution counts a certain number of points, depending on its difficulty. Contributors earn the appropriate
points when the work is merged. Contribution points are used to describe the contributions that contributors have made.
They can also be used to receive rewards for community events. You can view the current community submissions on a
public [google sheet](https://docs.google.com/spreadsheets/d/1ukyXgi_jRPeXj7EAST0IrnPfLOQ6xDBkcyAJY9N-Yb4/edit#gid=0).

Points: x

# Deadline

We usually give 2 weeks to issue, that means you have 2 weeks to implement the feature starting from the day the issue is assigned to you. If you have any difficulty, please contact us in Slack.

# How to claim to solve the issue

If you want to implement this function, please leave a comment in this issue like:

> I'd like to implement this function, please assign this issue to me.

FeatBit community will assign the issue to you on time.

