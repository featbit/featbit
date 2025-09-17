#!/bin/sh

# Abort on any error (including if wait-for-it fails).
set -e

envsubst < /usr/share/nginx/featbit/en/assets/env.template.js > /usr/share/nginx/featbit/en/assets/env.js
envsubst < /usr/share/nginx/featbit/zh/assets/env.template.js > /usr/share/nginx/featbit/zh/assets/env.js
exec nginx -g 'daemon off;'
