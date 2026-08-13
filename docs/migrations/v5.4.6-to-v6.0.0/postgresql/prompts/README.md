# PostgreSQL migration prompts: FeatBit 5.4.6 to 6.0.0

There are two independent prompts:

1. [Events migration](01-events-migration.prompt.md)
2. [Metrics and experimentation migration](02-metrics-and-experimentation-migration.prompt.md)

Both assume that the 5.4.6 PostgreSQL database no longer receives writes during migration. Each prompt asks the implementing agent to inspect the `5.4.6` tag and the current branch, implement the migration, and add tests.

`AGENTS.md` is not present in `5.4.6` or `main` and may describe an earlier state of the release-decision branch. An agent must still follow any local instructions that apply to its session, but migration decisions should be based on the tagged source code, the checked-out target code/schema, and executable tests—not on `AGENTS.md` as a technical specification.

The Events prompt only handles event evidence. The Metrics and Experimentation prompt only handles experiment metadata and stored historical results.
