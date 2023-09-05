# Notes

## Add Hosts

```
127.0.0.1       featbit.example
127.0.0.1       keycloak.featbit.example
127.0.0.1       api.featbit.example
127.0.0.1       demo.featbit.example
127.0.0.1       eval.featbit.example
127.0.0.1       nginx-auth-agent-proxy.featbit.example
127.0.0.1       ca.featbit.example
127.0.0.1       spa.featbit.example
```

## SSL/TLS

### Create Certificate

Create `certs` folder

```bash
cd /featbit/docker/SSO
mkdir certs && cd certs
```

1. Generate CA Private Key & Certificate
   ```bash
   openssl req -newkey rsa:2048 -nodes -keyout localCA.key -x509 -days 365 -out localCA.crt -subj "/C=lo/ST=local/L=local/O=local-ca/OU=local-ca/CN=FeatBit CA, LLC/emailAddress=featbit@contact.com"
   ```
2. Generate Server Private Key & CSR
    ```bash[localCA.srl](certs%2FlocalCA.srl)
    openssl req -newkey rsa:2048 -nodes -keyout localServer.key -out localServer.csr -extensions v3_ca -subj "/C=lo/ST=local/L=local/O=local-server/OU=local-server/CN=FeatBit, LLC/emailAddress=featbit@contact.com"
    ```
3. Create an extensions file named: `domain.ext`
   ```
   authorityKeyIdentifier=keyid,issuer
   basicConstraints=CA:FALSE
   subjectAltName = @alt_names
   extendedKeyUsage=serverAuth
   [alt_names]
   DNS.1 = *.featbit.example
   DNS.2 = featbit.example
   ```
4. Generate the Certificate using the CSR
   ```bash
   openssl x509 -req -in localServer.csr -CA localCA.crt -CAkey localCA.key -CAcreateserial -extfile domain.ext -out localServer.crt -days 365 -sha256
   ```
After running these commands, the following files will be created:

- localCA.key
- localCA.crt
- localCA.srl
- domain.ext
- localServer.crt
- localServer.csr
- localServer.key

Then you need to **install the CA certificate `localCA.crt` to your system**.

## Run

```bash
cd /featbit
docker compose --project-directory . -f ./docker/SSO/docker-compose-sso-dev.yml up -d
```
