'use strict'

const { devMode, makePool } = require( '../config' );
const pg = require('pg');

const conn = makePool( devMode ? 'dev' : 'anniv3', devMode ? 4 : 20 );

module.exports = {
    /** @type {pg.Pool} */
    conn: conn,
};