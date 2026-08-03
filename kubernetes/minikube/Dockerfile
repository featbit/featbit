FROM gcr.io/k8s-minikube/kicbase:v0.0.50

ARG REGISTRY_HOST=

ADD <MY_CA_CERT>.pem /usr/local/share/ca-certificates/<MY_CA_CERT>.crt
ADD <MY_INT_CERT>.pem /usr/local/share/ca-certificates/<MY_INT_CERT>.crt

RUN update-ca-certificates \
	&& mkdir -p /etc/docker/certs.d/${REGISTRY_HOST} \
	&& cat /usr/local/share/ca-certificates/<MY_CA_CERT>.crt /usr/local/share/ca-certificates/<MY_INT_CERT>.crt > /etc/docker/certs.d/${REGISTRY_HOST}/ca.crt \
	&& chmod 644 /etc/docker/certs.d/${REGISTRY_HOST}/ca.crt

