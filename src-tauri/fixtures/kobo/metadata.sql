-- Sanitized Kobo metadata fixture. It contains no ebook file, account data,
-- annotations or device identifier.
CREATE TABLE content (
  ContentID TEXT,
  Title TEXT,
  Attribution TEXT,
  ISBN TEXT,
  ContentType INTEGER,
  Accessibility INTEGER,
  ___PercentRead REAL,
  DateLastRead TEXT
);

INSERT INTO content VALUES
  ('file:///mnt/onboard/Books/the_left_hand_of_darkness.epub', 'The Left Hand of Darkness', 'Ursula K. Le Guin', '9780441478125', 6, 1, 0.62, '2026-10-05T09:30:00Z'),
  ('file:///mnt/onboard/Books/solenoid.epub', 'Solenoide', 'Mircea Cărtărescu', NULL, 6, 1, 1.0, '2026-09-30T18:12:00Z'),
  ('file:///mnt/onboard/Books/hidden.epub', 'Not importable', 'Example', NULL, 6, 0, 0.0, NULL),
  ('file:///mnt/onboard/Books/chapter.xhtml', 'Chapter one', NULL, NULL, 9, 1, 0.0, NULL);
