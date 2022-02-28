# messageboard-api

## Overview

Backend API server for collecting and displaying user-submitted messages.

Made using [Express.js](https://expressjs.com/) and [express-openapi-validator](https://github.com/cdimascio/express-openapi-validator).

## Running

The server can be ran locally by entering the `server` directory and using `npm start`.

## Documentation

The API specification can be found [in the OpenAPI3 spec](server/api/api-spec.yaml). In a running server, the specification is hosted with [Swagger UI](https://swagger.io/tools/swagger-ui/) in the `/spec` endpoint, with the raw spec file also being hosted under `/spec/raw`.