## Install Tool

```shell
cd featbit
dotnet tool restore
```

## Generate Initial Migration Script

> Please ensure that you set `DbProvider` to `Postgres` before running the following command.

```shell
cd featbit/modules/back-end/src
dotnet ef dbcontext script --project Infrastructure --startup-project Api --verbose -o Infrastructure/Persistence/EntityFrameworkCore/initial.sql
```