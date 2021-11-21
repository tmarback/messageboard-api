CREATE SCHEMA IF NOT EXISTS anniv3;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" SCHEMA anniv3;
CREATE TABLE IF NOT EXISTS anniv3.users(
    id          UUID            PRIMARY KEY DEFAULT anniv3.uuid_generate_v4(),
    username    VARCHAR( 20 )   NOT NULL UNIQUE,
    avatar      TEXT[]          NOT NULL
);

CREATE TABLE IF NOT EXISTS anniv3.messages(
    id          SERIAL                      PRIMARY KEY,
    author      UUID                        REFERENCES anniv3.users ( id ) ON UPDATE CASCADE ON DELETE CASCADE,
    content     VARCHAR( 500 )              NOT NULL,
    time_posted TIMESTAMP WITH TIME ZONE    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE ( author ) -- We're only allowing one message per person
);