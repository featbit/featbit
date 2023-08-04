#!/bin/sh

set -e

envsubst < /app/frontend/en/assets/env.template.js > /app/frontend/en/assets/env.js
envsubst < /app/frontend/zh/assets/env.template.js > /app/frontend/zh/assets/env.js

# Start Nginx
nginx -g 'daemon off;' & 

# Start Api
./backend/Api &

# Wait for any process to exit
wait

# Exit with status of process that exited first
exit $?