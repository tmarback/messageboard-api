'use strict'

const { conn } = require( './database' );

module.exports = {
  getMessages: (req, res) => {

    const page = req.query.page;
    const pageSize = req.query.pageSize;

    conn.connect()
        .then( client => {
            return Promise.all([
                client.query( `
                    SELECT   anniv3.messages.id AS id, username AS author, content, time_posted AS timestamp
                    FROM     anniv3.messages INNER JOIN anniv3.users ON anniv3.messages.author = anniv3.users.id
                    ORDER BY time_posted ASC, id ASC
                    LIMIT    $1
                    OFFSET   $2
                `, [ pageSize, ( page - 1 ) * pageSize ] ),
                client.query(`
                    SELECT c.reltuples::bigint AS estimate
                    FROM   pg_class c
                    JOIN   pg_namespace n ON n.oid = c.relnamespace
                    WHERE  c.relname = 'messages'
                    AND    n.nspname = 'anniv3'
                ` ) ]);
        }).then( data => {
            const pageData = data[0].rows;
            const pageCount = parseInt( data[1].rows[0].estimate / pageSize );
            if ( pageData.length > 0 ) {
                res.status( 200 ).json({
                    page: page,
                    pageSize: pageSize,
                    pageCount: pageCount,
                    pages: pageData,
                });
            } else {
                res.status( 404 ).json({
                    status: 404,
                    message: "Page does not exist",
                    pageCount: pageCount,
                });
            }
        });

  },

  postMessage: (req, res) => {

    throw { status: 501, message: "Not implemented yet" };
    /*
    const timestamp = new Date().toISOString();
    res.status(201).json({
      id: 0,
      timestamp: timestamp,
    });
    */

  }, 
};