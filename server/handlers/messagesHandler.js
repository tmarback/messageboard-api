'use strict'

const { getClient } = require( './database' );

module.exports = {
  getMessages: (req, res) => {

    const page = req.query.page;
    const pageSize = req.query.pageSize;

    getClient().then( client => {
        Promise.all([
            client.query(`
                SELECT   anniv3.messages.id AS id, username AS author, content, time_posted AS timestamp
                FROM     anniv3.messages INNER JOIN anniv3.users ON anniv3.messages.author = anniv3.users.id
                ORDER BY time_posted ASC, id ASC
                LIMIT    $1
                OFFSET   $2
            `, [ pageSize, ( page - 1 ) * pageSize ] ),
            client.query(`
                SELECT COUNT(*) AS total
                FROM   anniv3.messages
            `)
        ]).then( data => {
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
        }).finally(() => {
            client.release();
        });
    });

  },

  postMessage: (req, res) => {

    const author = req.body.author;
    const content = req.body.content;

    getClient().then( client => {
        client.query(`
            INSERT INTO anniv3.users ( username )
            VALUES ( $1 )
            ON CONFLICT DO NOTHING
        `, [ author ] ).then( r => client.query(`
            INSERT INTO anniv3.messages ( author, content )
            SELECT u.id, $2
            FROM anniv3.users u
            WHERE u.username = $1
            ON CONFLICT DO NOTHING
            RETURNING id, time_posted AS timestamp
        `, [ author, content ] )).then( result => {
            if ( result.rows.length > 0 ) {
                res.status( 201 );
                return result;
            } else {
                res.status( 409 );
                return client.query(`
                    SELECT anniv3.messages.id AS id, time_posted AS timestamp
                    FROM anniv3.messages INNER JOIN anniv3.users ON anniv3.messages.author = anniv3.users.id
                    WHERE username = $1
                `, [ author ] );
            }
        }).then( result => {
            res.json( result.rows[0] );
        }).finally(() => {
            client.release();
        });
    });

  },
};