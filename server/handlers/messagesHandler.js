'use strict'

const { getClient } = require( './database' );

module.exports = {
  getMessages: (req, res) => {

    const page = req.query.page;
    const pageSize = req.query.pageSize;

    getClient().then( client => {
            return Promise.all([
                client.query( `
                    SELECT   anniv3.messages.id AS id, username AS author, content, time_posted AS timestamp
                    FROM     anniv3.messages INNER JOIN anniv3.users ON anniv3.messages.author = anniv3.users.id
                    ORDER BY time_posted ASC, id ASC
                    LIMIT    $1
                    OFFSET   $2
                `, [ pageSize, ( page - 1 ) * pageSize ] ),
                client.query(`
                    SELECT COUNT(*) AS total
                    FROM   anniv3.messages
                ` ) ]);
        }).then( data => {
            const pageData = data[0].rows;
            const pageCount = Math.ceil( data[1].rows[0].total / pageSize );
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