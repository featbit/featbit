FROM nginx:latest

# install nodejs
ENV NODE_VERSION=16.13.0
RUN apt install -y curl
RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
ENV NVM_DIR=/root/.nvm
RUN . "$NVM_DIR/nvm.sh" && nvm install ${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm use v${NODE_VERSION}
RUN . "$NVM_DIR/nvm.sh" && nvm alias default v${NODE_VERSION}
ENV PATH="/root/.nvm/versions/node/v${NODE_VERSION}/bin/:${PATH}"
RUN node --version
RUN npm --version

# build
WORKDIR /front-end
COPY . /front-end
RUN npm install
RUN npm run build:prod

# Set up nginx
COPY dist/front-end /usr/share/nginx/html/
RUN rm /etc/nginx/nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/front-end /usr/share/nginx/html
COPY nginx/nginx.conf /etc/nginx
