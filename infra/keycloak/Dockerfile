FROM docker.io/bitnami/keycloak:21.1.2-debian-11-r5

USER root
ADD ./modules/oauth-agent/certs/featbit-ca-private-cert.pem /usr/local/share/ca-certificates/featbit-ca-private-cert.pem
ADD ./modules/oauth-agent/certs/featbit-example-wildcard.pem /usr/local/share/ca-certificates/featbit-example-wildcard.pem
RUN chmod 644 /usr/local/share/ca-certificates/featbit-ca-private-cert.pem && update-ca-certificates
RUN chmod 644 /usr/local/share/ca-certificates/featbit-example-wildcard.pem && update-ca-certificates