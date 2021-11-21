'use strict'

const { getClient } = require( './database' );
const asyncHandler = require( 'express-async-handler' );

module.exports = {
    getMessages: asyncHandler( async ( req, res ) => {

        const page = req.query.page;
        const pageSize = req.query.pageSize;

        const client = await getClient();
        var pageData;
        var pageCount;
        try {
            const resPage = await client.query(`
                SELECT   anniv3.messages.id AS id, username AS author, content, time_posted AS timestamp
                FROM     anniv3.messages INNER JOIN anniv3.users ON anniv3.messages.author = anniv3.users.id
                ORDER BY time_posted ASC, id ASC
                LIMIT    $1
                OFFSET   $2
            `, [ pageSize, ( page - 1 ) * pageSize ] );
            const resCount = await client.query(`
                SELECT COUNT(*) AS total
                FROM   anniv3.messages
            `);

            pageData = resPage.rows;
            pageCount = Math.ceil( resCount.rows[0].total / pageSize );
        } finally {
            client.release();
        };

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

    }),
    postMessage: asyncHandler( async ( req, res ) => {

        const author = req.body.author;
        const content = req.body.content;

        const client = await getClient();
        var result;
        try {
            await client.query(`
                INSERT INTO anniv3.users ( username )
                VALUES ( $1 )
                ON CONFLICT DO NOTHING
            `, [ author ] );
            result = await client.query(`
                INSERT INTO anniv3.messages ( author, content )
                SELECT u.id, $2
                FROM anniv3.users u
                WHERE u.username = $1
                ON CONFLICT DO NOTHING
                RETURNING id, time_posted AS timestamp
            `, [ author, content ] );

            if ( result.rows.length > 0 ) {
                res.status( 201 );
            } else {
                res.status( 409 );
                result = await client.query(`
                    SELECT anniv3.messages.id AS id, time_posted AS timestamp
                    FROM anniv3.messages INNER JOIN anniv3.users ON anniv3.messages.author = anniv3.users.id
                    WHERE username = $1
                `, [ author ] );
            }
        } finally {
            client.release();
        };
        res.json( result.rows[0] );

    }),
};