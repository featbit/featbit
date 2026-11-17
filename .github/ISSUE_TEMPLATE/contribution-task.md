---
name: Contribution task
about: Template for creating contribution task
title: "[Good First Issues]: The title of the issue"
labels: good first issue, help wanted, points:4
assignees: ''
---

# Description

# Scope

# Screenshot

# Setup dev environment

Please read the [doc](../../Development.md) to set up your development environment.

For React UI work, follow the [frontend development guide](../../modules/front-end/README.md) and [frontend instructions](../../modules/front-end/AGENTS.md).

# Deadline

We usually give 2 weeks for a feature request, which means you have 2 weeks to implement the feature starting from the
day it is assigned to you. If you have any difficulties, please contact us in [Discord](https://discord.gg/h9dVMsQH).

# How to implement

1. Fork the FeatBit repository.
2. Create a branch issues-{issues number}
3. Implement the task based on Description and Scope mentioned above.
4. Submit your PR

For UI changes, complete the following before submitting your PR. Run frontend commands from `modules/front-end`:

- Merge the FeatBit main branch into your working branch.
- Implement React UI changes in `modules/front-end`.
- For UI text changes, update both English and Chinese strings in `src/lib/i18n/resources/` and commit the changed resource files.
- Run `npm run build`, `npm run lint`, and `npm test`. The test suite includes existing i18n tests.
- For browser behavior changes, run the relevant Playwright tests with `npm run test:e2e`. For API/frontend integration or container changes, run `npm run test:e2e:containers`, which builds both application images from local source.
- Install Chromium with `npx playwright install chromium` before browser tests, and ensure Docker is running for container E2E.
- Include the validation commands and results in your PR. Use `modules/front-end/package.json` to verify available scripts.

# Contribution points

Each contribution counts a certain number of points, depending on its difficulty. Contributors earn the appropriate
points when the work is merged. Contribution points are used to describe the contributions that contributors have made.
They can also be used to receive rewards for community events. You can view the current community submissions on a
public [google sheet](https://docs.google.com/spreadsheets/d/1ukyXgi_jRPeXj7EAST0IrnPfLOQ6xDBkcyAJY9N-Yb4/edit#gid=1117970540).

Points: 4

# How to claim to solve the issue

If you want to implement this function, please leave a comment in this issue like:

> I'd like to implement this function, please assign this issue to me.
