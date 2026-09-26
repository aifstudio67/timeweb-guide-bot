import pg from "pg";

const { Pool } = pg;

function userValues(user) {
  return [
    String(user.id),
    user.username ?? null,
    user.first_name ?? null,
    user.last_name ?? null,
  ];
}

export function createLeadRepository({ databaseUrl, databaseSsl }) {
  const pool = new Pool({
    connectionString: databaseUrl,
    ssl: databaseSsl ? { rejectUnauthorized: false } : undefined,
  });

  async function initialize() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS leads (
        telegram_user_id BIGINT PRIMARY KEY,
        username TEXT,
        first_name TEXT,
        last_name TEXT,
        first_source TEXT NOT NULL DEFAULT 'direct',
        last_source TEXT NOT NULL DEFAULT 'direct',
        first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        subscribed_at TIMESTAMPTZ,
        guide_sent_at TIMESTAMPTZ,
        interest TEXT,
        help_requested_at TIMESTAMPTZ
      );

      CREATE TABLE IF NOT EXISTS bot_events (
        id BIGSERIAL PRIMARY KEY,
        telegram_user_id BIGINT NOT NULL REFERENCES leads(telegram_user_id) ON DELETE CASCADE,
        event_type TEXT NOT NULL,
        source TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS bot_events_type_created_at_idx
        ON bot_events (event_type, created_at DESC);
    `);
  }

  async function upsertLead(user, source) {
    await pool.query(
      `INSERT INTO leads (
        telegram_user_id, username, first_name, last_name, first_source, last_source
      ) VALUES ($1, $2, $3, $4, $5, $5)
      ON CONFLICT (telegram_user_id) DO UPDATE SET
        username = EXCLUDED.username,
        first_name = EXCLUDED.first_name,
        last_name = EXCLUDED.last_name,
        last_source = EXCLUDED.last_source,
        last_seen_at = NOW()`,
      [...userValues(user), source],
    );
  }

  async function recordEvent(userId, eventType, source = null) {
    await pool.query(
      `INSERT INTO bot_events (telegram_user_id, event_type, source)
       VALUES ($1, $2, $3)`,
      [String(userId), eventType, source],
    );
  }

  async function markSubscribed(userId) {
    await pool.query(
      `UPDATE leads
       SET subscribed_at = COALESCE(subscribed_at, NOW()), last_seen_at = NOW()
       WHERE telegram_user_id = $1`,
      [String(userId)],
    );
  }

  async function markGuideSent(userId) {
    await pool.query(
      `UPDATE leads
       SET guide_sent_at = NOW(), last_seen_at = NOW()
       WHERE telegram_user_id = $1`,
      [String(userId)],
    );
  }

  async function setInterest(userId, interest) {
    await pool.query(
      `UPDATE leads
       SET interest = $2, last_seen_at = NOW()
       WHERE telegram_user_id = $1`,
      [String(userId), interest],
    );
  }

  async function markHelpRequested(userId) {
    await pool.query(
      `UPDATE leads
       SET help_requested_at = NOW(), last_seen_at = NOW()
       WHERE telegram_user_id = $1`,
      [String(userId)],
    );
  }

  return {
    initialize,
    upsertLead,
    recordEvent,
    markSubscribed,
    markGuideSent,
    setInterest,
    markHelpRequested,
    close: () => pool.end(),
  };
}
