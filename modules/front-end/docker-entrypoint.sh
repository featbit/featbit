#!/bin/sh

# Abort on any error
set -e

# Remove trailing slash if present
BASE_HREF="${BASE_HREF%/}"

# Select and process nginx configuration based on BASE_HREF
if [ -n "$BASE_HREF" ]; then
  echo "Using nginx.base_href.conf with BASE_HREF=$BASE_HREF"
  envsubst '$BASE_HREF' < /etc/nginx/conf.d/nginx.base_href.conf > /etc/nginx/conf.d/default.conf
else
  echo "Using nginx.conf (default configuration)"
  cp /etc/nginx/conf.d/nginx.default.conf /etc/nginx/conf.d/default.conf
fi

# Remove the template files to avoid confusion
rm -f /etc/nginx/conf.d/nginx.base_href.conf /etc/nginx/conf.d/nginx.default.conf

# Process each locale directory
for locale in /usr/share/nginx/featbit/*; do
  if [ -d "$locale" ]; then
    lang=$(basename "$locale")

    # Update <base href="..."> inside index.html
    if [ -f "$locale/index.html" ]; then
      sed -i "s|<base href=\"/${lang}/\"|<base href=\"${BASE_HREF}/${lang}/\"|g" "$locale/index.html"
    fi

    # Generate env.js from env.template.js if available
    if [ -f "$locale/assets/env.template.js" ]; then
      envsubst < "$locale/assets/env.template.js" > "$locale/assets/env.js"
    fi
  fi
done

exec nginx -g 'daemon off;'
