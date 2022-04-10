'use strict'

import { devMode, makePool } from '../config.js';

const conn = makePool( devMode ? 4 : 20 );

export function getClient() { return conn.connect(); };
export function query( query, args = [] ) { return conn.query( query, args ); };
