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
ENV LOG_TO_FILE=1
ENV LOG_DIR="/var/log/server"

ENV DB_HOST="localhost"
ENV DB_PORT=5432
ENV DB_USER="dev"

# Server ports
EXPOSE ${PORT}

VOLUME ${LOG_DIR}

# Start command
CMD [ "npm", "start" ]