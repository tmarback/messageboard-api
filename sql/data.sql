CREATE SCHEMA IF NOT EXISTS messageboard;
CREATE SCHEMA IF NOT EXISTS extensions;

CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA extensions;
CREATE OR REPLACE FUNCTION messageboard.hash_email( TEXT ) returns TEXT AS $$
    SELECT encode( extensions.digest( $1, 'sha256' ), 'hex' )
$$ LANGUAGE SQL STRICT IMMUTABLE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA extensions;
CREATE TABLE IF NOT EXISTS messageboard.users(
    id          UUID            PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
    username    VARCHAR( 20 )   NOT NULL UNIQUE,
    email_hash  TEXT            NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS messageboard.avatars(
    id          UUID            PRIMARY KEY REFERENCES messageboard.users ( id ) ON UPDATE CASCADE ON DELETE CASCADE,
    avatar      TEXT[]          NOT NULL
);

CREATE TABLE IF NOT EXISTS messageboard.messages(
    id          SERIAL                      PRIMARY KEY,
    author      UUID                        REFERENCES messageboard.users ( id ) ON UPDATE CASCADE ON DELETE CASCADE,
    content     VARCHAR( 500 )              NOT NULL,
    time_posted TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    visible     BOOLEAN                     NOT NULL DEFAULT FALSE,
    UNIQUE ( author ) -- We're only allowing one message per person
);
CREATE UNIQUE INDEX IF NOT EXISTS visible_messages ON messageboard.messages ( id ) WHERE visible = TRUE;
CREATE UNIQUE INDEX IF NOT EXISTS pending_messages ON messageboard.messages ( id ) WHERE visible = FALSE;