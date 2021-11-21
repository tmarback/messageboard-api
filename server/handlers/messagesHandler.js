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
            await client.query( `BEGIN READ ONLY` );
            const resPage = await client.query(`
                SELECT   anniv3.messages.id AS id, time_posted AS timestamp, username, avatar, content
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
            await client.query( `COMMIT` );
        } catch ( e ) {
            await client.query( `ROLLBACK` );
            throw e;
        } finally {
            client.release();
        };

        if ( pageData.length > 0 ) {
            res.status( 200 ).json({
                page: page,
                pageSize: pageSize,
                pageCount: pageCount,
                pageData: pageData.map( m => ({
                    id: m.id,
                    timestamp: m.timestamp,
                    author: {
                        name: m.username,
                        avatar: m.avatar,
                    },
                    content: m.content,
                })),
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
            await client.query( `BEGIN` );
            await client.query(`
                INSERT INTO anniv3.users ( username, avatar )
                VALUES ( $1, $2 )
                ON CONFLICT DO NOTHING
            `, [ author.name, author.avatar ] );
            result = await client.query(`
                INSERT INTO anniv3.messages ( author, content )
                SELECT u.id, $2
                FROM anniv3.users u
                WHERE u.username = $1
                ON CONFLICT DO NOTHING
                RETURNING id, time_posted AS timestamp
            `, [ author.name, content ] );

            if ( result.rows.length > 0 ) {
                res.status( 201 );
                await client.query( `COMMIT` );
            } else {
                res.status( 409 );
                result = await client.query(`
                    SELECT anniv3.messages.id AS id, time_posted AS timestamp
                    FROM anniv3.messages INNER JOIN anniv3.users ON anniv3.messages.author = anniv3.users.id
                    WHERE username = $1
                `, [ author.name ] );
                await client.query( `ROLLBACK` ); // Should never happen of the first insert succeeding while
            }                                     // the second fails but JUST IN CASE
        } catch ( e ) {
            await client.query( `ROLLBACK` );
            throw e;
        } finally {
            client.release();
        };
        res.json( result.rows[0] );

    }),
};