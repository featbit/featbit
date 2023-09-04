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

Use the following information **while requesting a certificate**

- Country Name: lo
- State or Province Name: local
- Locality Name: local
- Organization Name: local
- Organizational Unit Name: local
- Common Name: featbit.example
- Email Address: featbit@contact.com

1. Create the CA Private Key
    ```bash
    openssl genrsa -des3 -out CAPrivate.key 2048
    ```
2. Generate the CA Root certificate
    ```bash
    openssl req -x509 -new -nodes -key CAPrivate.key -sha256 -days 365 -out CAPrivate.pem
    ```
3. Create a Private Key
    ```bash
    openssl genrsa -out ServerPrivate.key 2048
    ```
4. Generate the CSR
   ```bash
   openssl req -new -key ServerPrivate.key -extensions v3_ca -out ServerPrivate.csr
   ```
5. Create an extensions file named: `openssl.ss.cnf`
   ```
   basicConstraints=CA:FALSE
   subjectAltName=DNS:*.featbit.example
   extendedKeyUsage=serverAuth
   ```
6. Generate the Certificate using the CSR
   ```bash
   openssl x509 -req -in ServerPrivate.csr -CA CAPrivate.pem -CAkey CAPrivate.key -CAcreateserial -extfile openssl.ss.cnf -out ServerPrivate.crt -days 365 -sha256
   ```

After running these commands, the following files will be created:

- CAPrivate.key
- CAPrivate.pem
- CAPrivate.srl
- openssl.ss.cnf
- ServerPrivate.crt
- ServerPrivate.csr
- ServerPrivate.key

Then you need to **install the CA certificate `CAPrivate.pem` to your system**.

## Run

```bash
cd /featbit
docker compose --project-directory . -f ./docker/SSO/docker-compose-sso-dev.yml up -d
```
