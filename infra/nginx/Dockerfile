FROM bitnami/nginx:latest

USER root

RUN apt-get update && apt-get install -y curl dnsutils && rm -rf /var/lib/apt/lists/*

ADD ./modules/oauth-agent/certs/step-ca/root_ca.crt /usr/local/share/ca-certificates/root_ca.crt
RUN chmod 644 /usr/local/share/ca-certificates/root_ca.crt && update-ca-certificates

ADD ./modules/oauth-agent/certs/step-ca/intermediate_ca.crt /usr/local/share/ca-certificates/intermediate_ca.crt
RUN chmod 644 /usr/local/share/ca-certificates/intermediate_ca.crt && update-ca-certificates

ADD ./modules/oauth-agent/certs/step-ca/featbit-example.crt /usr/local/share/ca-certificates/featbit-example.crt
RUN chmod 644 /usr/local/share/ca-certificates/featbit-example.crt && update-ca-certificates