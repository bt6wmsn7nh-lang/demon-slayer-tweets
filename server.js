async function initializeDatabase() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username VARCHAR(20) NOT NULL UNIQUE,
      display_name VARCHAR(30) NOT NULL,
      password_hash TEXT NOT NULL,
      bio VARCHAR(160) NOT NULL DEFAULT '',
      avatar_style VARCHAR(20) NOT NULL DEFAULT 'water',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT users_username_lowercase CHECK (
        username = LOWER(username)
      ),
      CONSTRAINT users_avatar_style CHECK (
        avatar_style IN (
          'water',
          'flame',
          'mist',
          'thunder',
          'flower'
        )
      )
    );

    CREATE TABLE IF NOT EXISTS sessions (
      token_hash CHAR(64) PRIMARY KEY,
      user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
      expires_at TIMESTAMPTZ NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS posts (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
      content VARCHAR(280) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS likes (
      user_id BIGINT NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,
      post_id BIGINT NOT NULL
        REFERENCES posts(id)
        ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY (user_id, post_id)
    );

    CREATE INDEX IF NOT EXISTS sessions_expiry_idx
      ON sessions(expires_at);

    CREATE INDEX IF NOT EXISTS posts_created_idx
      ON posts(created_at DESC);

    CREATE INDEX IF NOT EXISTS likes_post_idx
      ON likes(post_id);
  `);

  // Fix databases made by older versions.
  // This does not delete existing accounts or tweets.
  await pool.query(`
    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS bio
      VARCHAR(160) NOT NULL DEFAULT '';

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS avatar_style
      VARCHAR(20) NOT NULL DEFAULT 'water';

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS created_at
      TIMESTAMPTZ NOT NULL DEFAULT NOW();

    ALTER TABLE posts
      ADD COLUMN IF NOT EXISTS created_at
      TIMESTAMPTZ NOT NULL DEFAULT NOW();

    ALTER TABLE sessions
      ADD COLUMN IF NOT EXISTS created_at
      TIMESTAMPTZ NOT NULL DEFAULT NOW();

    ALTER TABLE likes
      ADD COLUMN IF NOT EXISTS created_at
      TIMESTAMPTZ NOT NULL DEFAULT NOW();
  `);

  // Repair missing or invalid profile information.
  await pool.query(`
    UPDATE users
    SET bio = ''
    WHERE bio IS NULL;

    UPDATE users
    SET avatar_style = 'water'
    WHERE avatar_style IS NULL
       OR avatar_style NOT IN (
         'water',
         'flame',
         'mist',
         'thunder',
         'flower'
       );
  `);

  // Remove expired login sessions.
  await pool.query(`
    DELETE FROM sessions
    WHERE expires_at <= NOW()
  `);
}
