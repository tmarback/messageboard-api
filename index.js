'use strict';

const serverPort = 8855;

const express = require("express");
const http = require('http');
const path = require('path');

const app = express();

const YAML = require('yamljs')
const swaggerUI = require('swagger-ui-express');
const OpenApiValidator = require('express-openapi-validator');

app.use(express.json());

const specPath = path.join(__dirname, '/api/api-spec.yaml');
app.use('/spec/raw', express.static(specPath));

const spec = YAML.load(specPath); 
app.use('/spec', swaggerUI.serve, swaggerUI.setup(spec));

app.use(
  OpenApiValidator.middleware({
    apiSpec: spec,
    validateResponses: true,
    operationHandlers: path.join(__dirname, '/handlers'),
  }),
);

app.use((err, req, res, next) => {
  console.error(err)
  res.status(err.status || 500).json({
    message: err.message,
    // errors: err.errors,
  });
});

http.createServer(app).listen(serverPort);