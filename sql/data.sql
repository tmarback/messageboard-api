CREATE SCHEMA IF NOT EXISTS anniv3;

CREATE EXTENSION IF NOT EXISTS "pgcrypto" SCHEMA anniv3;
CREATE OR REPLACE FUNCTION anniv3.hash_email( TEXT ) returns TEXT AS $$
    SELECT encode( anniv3.digest( $1, 'sha256' ), 'hex' )
$$ LANGUAGE SQL STRICT IMMUTABLE;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA anniv3;
CREATE TABLE IF NOT EXISTS anniv3.users(
    id          UUID            PRIMARY KEY DEFAULT anniv3.uuid_generate_v4(),
    username    VARCHAR( 20 )   NOT NULL UNIQUE,
    email_hash  TEXT            NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS anniv3.avatars(
    id          UUID            PRIMARY KEY REFERENCES anniv3.users ( id ) ON UPDATE CASCADE ON DELETE CASCADE,
    avatar      TEXT[]          NOT NULL
);

CREATE TABLE IF NOT EXISTS anniv3.messages(
    id          SERIAL                      PRIMARY KEY,
    author      UUID                        REFERENCES anniv3.users ( id ) ON UPDATE CASCADE ON DELETE CASCADE,
    content     VARCHAR( 500 )              NOT NULL,
    time_posted TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ( author ) -- We're only allowing one message per person
);