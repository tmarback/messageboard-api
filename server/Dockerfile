FROM node:17-alpine

WORKDIR /usr/src/server

# Configure build environment
ENV NODE_ENV="production"

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source
COPY . .

# Configure run environment
ENV DEV=1
ENV LOCAL=0
ENV VERBOSE=0

ENV PORT=8855
ENV HOST="localhost:${PORT}"
ENV WEBSITE_ORIGIN="localhost"
ENV TRUSTED_PROXIES=0

ENV ASSETS_DIR="./assets"
ENV ASSETS_URI="localhost"

ENV LOG_TO_FILE=1
ENV LOG_DIR="/var/log/server"

ENV DB_HOST="localhost"
ENV DB_PORT=5432
ENV DB_USER="dev"
ENV DB_NAME="dev"

# For DB logging
ENV APP_NAME="messageboard"
# For auth
ENV APP_AUTH="messageboard"

# Server ports
EXPOSE ${PORT}

VOLUME ${LOG_DIR}

# Start command
CMD [ "npm", "start" ]