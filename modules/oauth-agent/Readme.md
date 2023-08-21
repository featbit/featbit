# OAUTH Development Notes

At a high level, the `backend-for-frontend` / `token handler` pattern being implemented can be found here.

https://curity.io/resources/learn/the-token-handler-pattern/


The OAuth agent is developed by Curity and is licensed with Apache 2.0. The agent code should work with any OIDC IDP and has been tested with KeyCloak.  The code base also lends itself well to being adapted later for dynamic settings in a multi tenant environment.

Due to licensing, it's included as a submodule from my fork.

https://github.com/wss-rbrennan/oauth-agent-dotnet

and it's using the branch `feature/dev-settings`

the original repo and be found at 

https://github.com/curityio/oauth-agent-dotnet

It would be best for the featbit project to fork the original repo, then use that repo as the sub-module to avoid and license conflicts.  As MIT and Apache 2.0 are compatible licenses, there should be no conflicts but credit to the original developers must be given and the license can't be changed by a downstream project.

## Development Challenges

Developing this part of the solution requires that the development environment have properly functioning DNS, a reverse proxy, and a trusted SSL certificate or certificates.  These requirements are discussed below in their own sections.



### DNS

If developing on windows and you don't have access to a dns server the easiest way to fake dns names is by editing your host file, the same can be done on linux machines

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
127.0.0.1       nginx-auth-agent-proxy.featbit.example
127.0.0.1       ca.featbit.example
127.0.0.1       spa.featbit.example
```

### SSL

Developing the SSO solution requires certificates and knowledge of certificate creation and trust relationships.  This section contains is not a set of instructions and is intended to serve as notes for creating the certificates and trust relationships need for the development environment to work properly. It is also assumed that development is being done on windows with a working wsl environment 

Generate CA and Wildcard SSL certificate using these instructions using wsl or linux
https://www.brainbytez.nl/tutorials/linux-tutorials/create-a-self-signed-wildcard-ssl-certificate-openssl/

Copy certs to modules/oauth-agent/certs if using wsl this is can be done the executing the following in the folder that contains the certificates and then copy like any other files in File Explorer
```
explorer.exe .
```


After copying the cert and bringing up the compose stack, navigate to https://featbit.example at this stage you'll get a self signed certificate warning, you could allow anyway in the browser, but it's better to export the cert and the add it to the trusted root and trusted CAs in your OS as all other subdomains will have the same issue with the self signed certificate.

follow these instructions on windows
https://techcommunity.microsoft.com/t5/windows-server-essentials-and/installing-a-self-signed-certificate-as-a-trusted-root-ca-in/ba-p/396105

or these

https://support.kaspersky.com/CyberTrace/3.1/en-US/174127.htm

This article is also a great reference
https://medium.com/@tbusser/creating-a-browser-trusted-self-signed-ssl-certificate-2709ce43fd15


#### step-ca notes 

step-ca has been included in the development stack as a somewhat easy way to manage a certificate authority and create x509 certificates, it is not required and if you are using you own method of generating certificates, it can be commented out of the docker-compose-dev-sso.yml file. In fact, even if it is used, it can be commented out after the necessary certificates have been created.

Documentation can be found here.

https://hub.docker.com/r/smallstep/step-ca


default admin username is `step`

extend cert lifetime 
```
step ca provisioner update admin --x509-max-dur=12000h
```

generate cert
```
step ca certificate --kty RSA --not-after 2024-08-17T00:00:00+00:00 --san featbit.example --san *.featbit.example *.featbit.example featbit-example.crt featbit-example.key

```

make sure key is in the right format
```
step crypto key format --pem --pkcs8 --out featbit-example-pkcs-key.pem featbit-example-key.pem
```

create https key store file for keycloak
```
keytool -importkeystore -srckeystore featbit-example.p12 -srcstoretype PKCS12 -destkeystore featbit-example.jks -deststoretype JKS
```

remove password from certificate key
```
openssl pkcs8 -topk8 -nocrypt -in featbit-example-pkcs-key.enc.pem -out featbit-example-pkcs-key.pem
```

create certificate with 
### NGINX Reverse Proxy
This also requires a reverse proxy to appear to the browser as a first party cookie, for that purpose nginx in reverse proxy mode is included.

### Docker Image Build

```
docker build --no-cache --progress=plain -f .\deploy\Dockerfile . -t featbit/oauth-agent
```

#### Notes:

Useful command for checking dns and network issues
```
docker run -it --network featbit-dev_featbit-network busybox /bin/sh
```
Useful for rebuilding images
ID=$(docker images --format="{{.Repository}} {{.ID}}" |  grep "featbit/oauth-agent" |  cut -d' ' -f2) && docker image rm $ID
ID=$(docker images --format="{{.Repository}} {{.ID}}" |  grep "featbit/keycloak" |  cut -d' ' -f2) && docker image rm $ID
ID=$(docker images --format="{{.Repository}} {{.ID}}" |  grep "featbit/nginx" |  cut -d' ' -f2) && docker image rm $ID
