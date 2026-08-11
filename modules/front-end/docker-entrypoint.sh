#!/bin/sh

set -e

# Normalize BASE_HREF so both "fbtest" and "/fbtest/" are served as "/fbtest".
BASE_HREF="${BASE_HREF%/}"

if [ -n "$BASE_HREF" ]; then
  case "$BASE_HREF" in
    /*) ;;
    *) BASE_HREF="/$BASE_HREF" ;;
  esac
fi

export BASE_HREF

if [ -n "$BASE_HREF" ]; then
  echo "Using nginx.base_href.conf.template with BASE_HREF=$BASE_HREF"
  envsubst '$BASE_HREF' < /etc/nginx/conf.d/nginx.base_href.conf.template > /etc/nginx/conf.d/default.conf

  if [ -f /usr/share/nginx/featbit/index.html ]; then
    sed -i "s|href=\"/assets/|href=\"${BASE_HREF}/assets/|g" /usr/share/nginx/featbit/index.html
    sed -i "s|src=\"/assets/|src=\"${BASE_HREF}/assets/|g" /usr/share/nginx/featbit/index.html
  fi
else
  echo "Using nginx.conf.template"
  cp /etc/nginx/conf.d/nginx.conf.template /etc/nginx/conf.d/default.conf
fi

if [ -f /usr/share/nginx/featbit/assets/env.template.js ]; then
  envsubst < /usr/share/nginx/featbit/assets/env.template.js > /usr/share/nginx/featbit/assets/env.js
fi

exec nginx -g 'daemon off;'
