#!/bin/sh

# Abort on any error (including if wait-for-it fails).
set -e

# Remove trailing slash if present
BASE_HREF="${BASE_HREF%/}"

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
