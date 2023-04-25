---
name: Contribution task
about: Template for creating contribution task
title: "[Good First Issues]: XXX"
labels: good first issue, help wanted, points:4
assignees: ''
---

# Description

# Scope

# Screenshot

# Setup dev environment

Please read the [doc](../blob/main/Development.md) to set up your development environment.

# Deadline

We usually give 2 weeks for a feature request, which means you have 2 weeks to implement the feature starting from the
day it is assigned to you. If you have any difficulties, please contact us
in [Slack](https://join.slack.com/t/featbit/shared_invite/zt-1ew5e2vbb-x6Apan1xZOaYMnFzqZkGNQ).

# How to implement

1. Fork the FeatBit repository.
2. Create a branch issues-{issues number}
3. Implement the task based on Description and Scope mentioned above.
4. Submit your PR

If the feature is UI related, make sure you complete the following tasks before submit your PR:

- merge featbit main branch into your working branch
- run `npm run i18n`
- commit **messages.xlf & messages.zh.xlf** file changes (if any)

# Contribution points

Each contribution counts a certain number of points, depending on its difficulty. Contributors earn the appropriate
points when the work is merged. Contribution points are used to describe the contributions that contributors have made.
They can also be used to receive rewards for community events. You can view the current community submissions on a
public [google sheet](https://docs.google.com/spreadsheets/d/1ukyXgi_jRPeXj7EAST0IrnPfLOQ6xDBkcyAJY9N-Yb4/edit#gid=1117970540).

Points: x

# How to claim to solve the issue

If you want to implement this function, please leave a comment in this issue like:

> I'd like to implement this function, please assign this issue to me.
