FROM docker.io/bitnami/keycloak:21.1.2-debian-11-r5

USER root
# ADD ./modules/oauth-agent/certs/featbit-ca-private-cert.pem /usr/local/share/ca-certificates/featbit-ca-private-cert.pem
# ADD ./modules/oauth-agent/certs/featbit-example-wildcard.pem /usr/local/share/ca-certificates/featbit-example-wildcard.pem
# RUN chmod 644 /usr/local/share/ca-certificates/featbit-ca-private-cert.pem && update-ca-certificates
# RUN chmod 644 /usr/local/share/ca-certificates/featbit-example-wildcard.pem && update-ca-certificates

ADD ./modules/oauth-agent/certs/step-ca/root_ca.crt /usr/local/share/ca-certificates/root_ca.crt
RUN chmod 644 /usr/local/share/ca-certificates/root_ca.crt && update-ca-certificates

ADD ./modules/oauth-agent/certs/step-ca/intermediate_ca.crt /usr/local/share/ca-certificates/intermediate_ca.crt
RUN chmod 644 /usr/local/share/ca-certificates/intermediate_ca.crt && update-ca-certificates

ADD ./modules/oauth-agent/certs/step-ca/featbit-example.crt /usr/local/share/ca-certificates/featbit-example.crt
RUN chmod 644 /usr/local/share/ca-certificates/featbit-example.crt && update-ca-certificates

