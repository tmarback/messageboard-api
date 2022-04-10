'use strict'

import { mkdir, rm } from 'fs/promises';
import path from 'path';

import { makeLogger, assetsDir, assetsUri, devMode } from '../config.js';
import { getClient, query } from './database.js';

import asyncHandler from 'express-async-handler';
import validator from 'email-validator';
import axios from 'axios';
import Jimp from 'jimp';

const logger = makeLogger( 'messages' );

const MESSAGE_EXISTS_ERROR = {
    status: 409,
    message: `User already posted a message`
};

async function getMessagesBase( req, res, visible ) {

    const page = req.query.page;
    const pageSize = req.query.pageSize;

    const client = await getClient();
    var pageData;
    var pageCount;
    try {
        await client.query( `BEGIN READ ONLY` );
        const resPage = await client.query(`
            SELECT   messageboard.messages.id AS id, time_posted AS timestamp, username, avatar, content
            FROM     messageboard.messages 
                        INNER JOIN messageboard.users ON messageboard.messages.author = messageboard.users.id 
                        INNER JOIN messageboard.avatars ON messageboard.users.id = messageboard.avatars.id 
            WHERE visible = $1
            ORDER BY time_posted ASC, id ASC
            LIMIT    $2
            OFFSET   $3
        `, [ visible, pageSize, ( page - 1 ) * pageSize ] );
        const resCount = await client.query(`
            SELECT COUNT(*) AS total
            FROM   messageboard.messages
            WHERE  visible = $1
        `, [ visible ] );

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

}

export const getMessages = asyncHandler( ( req, res ) => getMessagesBase( req, res, true ) );

export const postMessage = asyncHandler( async ( req, res ) => {

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

    if ( author.email == null ) {
        throw {
            status: 400,
            message: "Must provide email address when posting a message",
        };
    }

    if ( !devMode ) { // Skip email checking while developing
        // TODO: Deep email validation, maybe if https://github.com/mfbx9da4/deep-email-validator
        // ever gets its dependencies fixed...
        if ( !validator.validate( author.email ) ) {
            throw {
                status: 400,
                message: `Invalid email address: ${author.email}`,
            }
        }
    }

    const client = await getClient();
    var result;
    var userPath = null;
    try {
        await client.query( `BEGIN` );

        result = await client.query(`
            INSERT INTO messageboard.users ( username, email_hash )
            VALUES ( $1, messageboard.hash_email( $2 ) )
            ON CONFLICT DO NOTHING
            RETURNING id
        `, [ author.name, author.email ] );
        if ( result.rows.length === 0 ) {
            throw MESSAGE_EXISTS_ERROR;
        }
        const uid = result.rows[0].id;

        const userDir = `${uid}`;
        userPath = path.join( assetsDir, userDir );
        await mkdir( userPath, 0o775 );
        const frames = await Promise.allSettled( author.avatar.map( async ( url, idx ) => {
            try {
                logger.debug( `Downloading avatar frame ${idx} for user ${uid} from ${url}` );
                const response = await axios.get( url, {
                    responseType: 'arraybuffer',
                    maxContentLength: 10_000_000,
                    maxRedirects: 5,
                    timeout: 5_000,
                });
                logger.debug( `Avatar frame ${idx} for user ${uid} downloaded` );
                const buffer = Buffer.from( response.data, 'binary' );
                const image = await Jimp.read( buffer );
                image.cover( 300, 300, Jimp.HORIZONTAL_ALIGN_CENTER | Jimp.VERTICAL_ALIGN_MIDDLE );
                logger.silly( `Avatar frame ${idx} for user ${uid} converted` );

                const filename = `${idx}.png`
                await image.writeAsync( path.join( userPath, filename ) );
                logger.silly( `Avatar frame ${idx} for user ${uid} saved` );
                return `${assetsUri}/${userDir}/${filename}`;
            } catch ( e ) {
                logger.verbose( `Avatar frame ${idx} (${url}) download failed: ${e}` );
                return null;
            }
        })).then( results => results.map( r => {
            switch ( r.status ) {
                case 'fulfilled':
                    return r.value;
                case 'rejected':
                    throw r.reason;
            }
        }));
        const invalidFrames = author.avatar.filter( ( url, idx ) => frames[idx] == null );
        if ( invalidFrames.length > 0 ) {
            throw {
                status: 400,
                message: `Invalid avatar frame URLs: [${invalidFrames.join( ', ' )}]`,
            };
        }

        await client.query(`
            INSERT INTO messageboard.avatars ( id, avatar )
            VALUES ( $1, $2 )
        `, [ uid, frames ] );

        result = await client.query(`
            INSERT INTO messageboard.messages ( author, content )
            VALUES ( $1, $2 )
            ON CONFLICT DO NOTHING
            RETURNING id, time_posted AS timestamp
        `, [ uid, content ] );
        if ( result.rows.length === 0 ) { // Should never happen of the first insert succeeding 
            throw MESSAGE_EXISTS_ERROR;   // while the second fails but JUST IN CASE
        }    
        await client.query( `COMMIT` );                                 
    } catch ( e ) {
        if ( userPath != null ) {
            await rm( userPath, { recursive: true, force: true } );
        }
        await client.query( `ROLLBACK` );
        throw e;
    } finally {
        client.release();
    }
    res.status( 201 ).json( result.rows[0] );

});

export const getMessagesAdmin = asyncHandler( ( req, res ) => getMessagesBase( req, res, !req.query.pending ) );

export const putMessagesAdmin = asyncHandler( async ( req, res ) => {

    /** @type {number} */
    const id = req.query.id;
    /** @type {boolean} */
    const approve = req.query.approve;

    const result = await query(`
        UPDATE messageboard.messages
        SET visible = $1
        WHERE id = $2
        RETURNING 1
    `, [ approve, id ] );

    if ( result.rows.length > 0 ) {
        res.status( 204 ).end();
    } else {
        throw {
            status: 404,
            message: "Not Found",
        };
    }

});

export const deleteMessagesAdmin = asyncHandler( async ( req, res ) => {

    /** @type {number} */
    const id = req.query.id;
    /** @type {boolean} */
    const ban = req.query.ban;

    const result = await query(
        ban ?`
            DELETE FROM messageboard.messages
            WHERE id = $1
            RETURNING 1
        ` : `
            DELETE FROM messageboard.users
            WHERE id = ( SELECT author FROM messageboard.messages WHERE id = $1 )
            RETURNING 1
        `, [ id ] );

    if ( result.rows.length > 0 ) {
        res.status( 204 ).end();
    } else {
        throw {
            status: 404,
            message: "Not Found",
        };
    }

});