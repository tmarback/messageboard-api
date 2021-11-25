'use strict'

const { getClient } = require( './database' );
const asyncHandler = require( 'express-async-handler' );
const validator = require("email-validator");

const AVATAR_PROTOCOLS = [
    'http',
    'https,'
].map( p => `${p}://` );
const AVATAR_FORMATS = [
    'png',
    'jpg',
    'jpeg',
].map( f => `.${f}` );

const USER_EXISTS_ERROR = {
    status: 409,
    message: `User already posted a message`
};

/**
 * Determines if a given URL is NOT a valid image URL.
 * NOTE: already verified by express-openapi-validator
 * to be a valid URI, just need to check if is a supported
 * one.
 * 
 * @param {string} url The URL to check
 * @returns {boolean} Whether the URL is NOT valid
 */
function isAvatarUrlInvalid( url ) {
    
    const valid = AVATAR_PROTOCOLS.some( proto => url.startsWith( proto ) ) &&
                  AVATAR_FORMATS  .some( fmt   => url  .endsWith( fmt   ) );
    return !valid;

}

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

        /**
         * @typedef {Object} Author
         * @property {string} name
         * @property {string[]} avatar
         * @property {string} email
         */
        /** @type {Author} */
        const author = req.body.author;
        /** @type {string} */
        const content = req.body.content;

        // TODO: Deep email validation, maybe if https://github.com/mfbx9da4/deep-email-validator
        // ever gets its dependencies fixed...
        if ( !validator.validate( author.email ) ) {
            throw {
                status: 400,
                message: `Invalid email address: ${author.email}`,
            }
        }

        const invalidFrames = author.avatar.filter( isAvatarUrlInvalid );
        if ( invalidFrames.length > 0 ) {
            throw {
                status: 400,
                message: `Invalid avatar frame URLs: [${invalidFrames.join( ', ' )}]`,
            };
        }

        const client = await getClient();
        var result;
        try {
            await client.query( `BEGIN` );

            result = await client.query(`
                INSERT INTO anniv3.users ( username, avatar, email_hash )
                VALUES ( $1, $2, anniv3.hash_email( $3 ) )
                ON CONFLICT DO NOTHING
                RETURNING id
            `, [ author.name, author.avatar, author.email ] );
            if ( result.rows.length === 0 ) {
                throw USER_EXISTS_ERROR;
            }

            result = await client.query(`
                INSERT INTO anniv3.messages ( author, content )
                SELECT u.id, $2
                FROM anniv3.users u
                WHERE u.username = $1
                ON CONFLICT DO NOTHING
                RETURNING id, time_posted AS timestamp
            `, [ author.name, content ] );
            if ( result.rows.length === 0 ) { // Should never happen of the first insert succeeding 
                throw USER_EXISTS_ERROR;      // while the second fails but JUST IN CASE
            }    
            await client.query( `COMMIT` );                                 
        } catch ( e ) {
            await client.query( `ROLLBACK` );
            throw e;
        } finally {
            client.release();
        }
        res.status( 201 ).json( result.rows[0] );

    }),
};