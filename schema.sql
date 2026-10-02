-- =====================================================
-- USERS
-- =====================================================

CREATE TABLE IF NOT EXISTS users (

  user_id TEXT PRIMARY KEY,

  first_name TEXT NOT NULL,

  balance REAL DEFAULT 0,

  referral_code TEXT UNIQUE,

  referred_by TEXT,

  phone TEXT,

  total_played REAL DEFAULT 0,

  total_won REAL DEFAULT 0,

  vip_level TEXT DEFAULT 'Bronze',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

-- =====================================================
-- BONUSES
-- =====================================================

CREATE TABLE IF NOT EXISTS bonuses (

  user_id TEXT PRIMARY KEY,

  claimed INTEGER DEFAULT 0,

  claimed_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

-- =====================================================
-- REFERRALS
-- =====================================================

CREATE TABLE IF NOT EXISTS referrals (

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  referrer_user_id TEXT NOT NULL,

  referred_user_id TEXT NOT NULL,

  bonus_amount REAL DEFAULT 15,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

-- =====================================================
-- TRANSACTIONS
-- =====================================================

CREATE TABLE IF NOT EXISTS transactions (

  id TEXT PRIMARY KEY,

  user_id TEXT NOT NULL,

  first_name TEXT,

  type TEXT NOT NULL,

  amount REAL NOT NULL,

  details TEXT,

  proof_image TEXT,

  status TEXT DEFAULT 'Pending',

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

-- =====================================================
-- WINNERS
-- =====================================================

CREATE TABLE IF NOT EXISTS winners (

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  user_id TEXT NOT NULL,

  first_name TEXT,

  ticket_id INTEGER,

  prize REAL,

  pattern TEXT,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

-- =====================================================
-- GAMES
-- =====================================================

CREATE TABLE IF NOT EXISTS games (

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  game_id TEXT UNIQUE,

  status TEXT DEFAULT 'waiting',

  prize_pool REAL DEFAULT 0,

  winner_user_id TEXT,

  total_players INTEGER DEFAULT 0,

  started_at DATETIME,

  ended_at DATETIME,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

-- =====================================================
-- TICKETS
-- =====================================================

CREATE TABLE IF NOT EXISTS tickets (

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  game_id TEXT,

  user_id TEXT,

  ticket_number INTEGER,

  board_json TEXT,

  price REAL DEFAULT 10,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

-- =====================================================
-- GAME ROUNDS
-- =====================================================

CREATE TABLE IF NOT EXISTS game_rounds (

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  game_id TEXT,

  status TEXT DEFAULT 'waiting',

  current_ball INTEGER DEFAULT 0,

  balls_drawn TEXT,

  winner_user_id TEXT,

  prize_pool REAL DEFAULT 0,

  created_at DATETIME DEFAULT CURRENT_TIMESTAMP

);

-- =====================================================
-- GAME PLAYERS
-- =====================================================

CREATE TABLE IF NOT EXISTS game_players (

  id INTEGER PRIMARY KEY AUTOINCREMENT,

  game_id TEXT,

  user_id TEXT,

  ticket_id INTEGER,

  joined_at DATETIME DEFAULT CURRENT_TIMESTAMP

);
