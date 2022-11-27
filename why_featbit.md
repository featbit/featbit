
I will explain why FeatBit in 4 steps:

- Original intention
- The evolution
- Existing solutions
- What are we different


# Original intention: An infrastructure system for Feature Flags 

Feature flags is a software engineering technique that turns select functionality on and off during runtime without redeploying the code. 

In the beginning, engineering teams use it to speed-up feature releases and reduce delivery risk. Common use cases are like:

- Testing new features in production.
- Progressive Delivery.
- Targeted rollouts.
- Safe and smooth data migration without impact.
- Trunk-based development
- Etc.

# The evolution BizDevOps: All teams need it

For many data-driven/user-driven teams, product managers use it to improve user experience by:

- Fine-grained targeting for who sees what experiences when.
- Measuring the impact of features' rollouts.
- Running A/B tests to improve feature quality.

With the evolution of this technology, feature flags evolved to feature management, which more teams started to benefit from. For example, feature management:

- Enable Sales and Customer Success to close more deals with live demos and feature trials at the push of a button. 
- Help Support debug exactly which features and tests a customer has for faster resolution. 
- Give Marketing and Design the ability to fine-tune target audiences, coordinate announcements, and manage special customer programs.
- Empower finance teams easily get the billing report of how customers used and paid for the different features and subscriptions.
- Etc.

# Existing solutions

Many companies self-develop their feature flags system. But as the company and product thrived, the self-developed system encountered problems, like performance issues, inconveniences for teamwork, more requirements features for non-engineering teams, and so on. Self-development teams have struggled to put more energy into providing a high-quality feature management system. It needs time and practical experience to meet needs. This means expensive and inefficient!

Some teams started to find an existing solution to replace their self-developed product. Launchdarkly is a good one, but many teams refused to use it because it's not open-source.
Some teams tried Unleash, but it's only open core, not developer friendly, and it didn't show any esprit of Empower all teams. Some teams have even criticized his performance issues. Some teams didn't use Unleash because of the technology stack. Other open-source products also have more or less related problems.
That's why we decided to start a 100% open-source (inspired by MinIO) project FeatBit, a scalable and high-performance Feature Management platform to Empower all teams to deliver, control, experiment with, and monetize their software.
We're just beginning and we want to provide more to the world. Now, FeatBit is already an alternative to existing feature management solutions. Try FeatBit!
