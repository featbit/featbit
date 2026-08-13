#!/bin/sh

# Based on BMitch's answer from:
# https://stackoverflow.com/questions/38946683/how-to-test-dockerignore-file

# Note: will create and delete temporary file "Dockerfile.build-context"

# 1. Copy to project folder where image is being built
# 2. Run script
# 3. You should see list of files in build context
# 4. If unwanted files in context, adjust .dockerignore file and go back to step 2

cat <<EOF > Dockerfile.build-context
FROM busybox
COPY . /build-context
WORKDIR /build-context
CMD find .
EOF

docker build -f Dockerfile.build-context -t build-context .
docker run --rm -it build-context

rm Dockerfile.build-context