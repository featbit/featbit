# OAUTH Development Notes

At a high level, the `backend-for-frontend` / `token handler` pattern being implemented can be found here.

https://curity.io/resources/learn/the-token-handler-pattern/


The OAuth agent is developed by Curity and is licensed with Apache 2.0. The agent code should work with any OIDC IDP and has been tested with KeyCloak.  The code base also lends itself well to being adapted later for dynamic settings in a multi tenant environment.

Due to licensing, it's included as a submodule from my fork.

https://github.com/wss-rbrennan/oauth-agent-dotnet

and it's using the branch `feature/dev-settings`

the original repo and be found at 

https://github.com/curityio/oauth-agent-dotnet

Should this solution prove fruitful, It would be best for the featbit project to fork the original repo, then use that repo as the submodule to avoid and license conflicts.  As MIT and Apache 2.0 are compatible licenses, there should be no conflicts but credit to the original developers must be given and the license can't be changed by a downstream project.

## Development Challenges

Developing this part of the solution requires that the development environment have properly functioning DNS, a reverse proxy, and a trusted SSL certificate or certificates.  These requirments are discussed below in their own sections.

### DNS

If developing on windows and you don't have access to a dns server the easiest way to fake dns names is by editing you
host file, the same can be done on linux machines

The entry would be something like this on windows

```
# Copyright (c) 1993-1999 Microsoft Corp.
#
# This is a sample HOSTS file used by Microsoft TCP/IP for Windows.
#
# This file contains the mappings of IP addresses to host names. Each
# entry should be kept on an individual line. The IP address should
# be placed in the first column followed by the corresponding host name.
# The IP address and the host name should be separated by at least one
# space.
#
# Additionally, comments (such as these) may be inserted on individual
# lines or following the machine name denoted by a '#' symbol.
#
# For example:
#
#      102.54.94.97     rhino.acme.com          # source server
#       38.25.63.10     x.acme.com              # x client host
#


127.0.0.1       localhost
127.0.0.1       featbit.example
127.0.0.1       keycloak.featbit.example
127.0.0.1       api.featbit.example
127.0.0.1       demo.featbit.example
127.0.0.1       eval.featbit.example
```

### SSL


### NGINX Reverse Proxy
This also requires a reverse proxy to appear to the browser as a first party cookie, for that purpose nginx in reverse proxy mode is included.



#### Notes:

Useful command for checking dns and network issues
```
docker run -it --network featbit-dev_featbit-network busybox /bin/sh
```

