## Install Tool

```shell
dotnet tool install --global dotnet-ef --version 8.0.12
```

## Generate Initial Migration Script

```shell
cd featbit/modules/back-end/src
dotnet ef dbcontext script --project Infrastructure --startup-project Api --verbose -o Infrastructure/Persistence/EFCore/initial.sql
```