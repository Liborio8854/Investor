-- inv_prices: denní ceny (FMP quote)
CREATE TABLE IF NOT EXISTS inv_prices (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker text NOT NULL,
  date date NOT NULL,
  price numeric,
  change_percent numeric,
  market_cap numeric,
  pe_ratio numeric,
  volume numeric,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (ticker, date)
);

CREATE INDEX IF NOT EXISTS inv_prices_ticker_date_idx ON inv_prices (ticker, date DESC);

-- inv_fundamentals: týdenní fundamenty (FMP key-metrics-ttm)
CREATE TABLE IF NOT EXISTS inv_fundamentals (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  ticker text NOT NULL,
  date date NOT NULL,
  roic numeric,
  roe numeric,
  net_margin numeric,
  gross_margin numeric,
  revenue_growth numeric,
  fcf_per_share numeric,
  updated_at timestamptz DEFAULT now(),
  UNIQUE (ticker, date)
);

CREATE INDEX IF NOT EXISTS inv_fundamentals_ticker_date_idx ON inv_fundamentals (ticker, date DESC);
