ALTER TABLE recommendation_options
  DROP CONSTRAINT recommendation_options_confidence_label_check;

ALTER TABLE recommendation_options
  ADD CONSTRAINT recommendation_options_confidence_label_check
  CHECK (confidence_label IN ('BANKER', 'CALCULATED_RISK', 'BOLD_PUNT'));

UPDATE recommendation_options
  SET confidence_label = CASE
    WHEN confidence_label = 'HIGH' THEN 'BANKER'
    WHEN confidence_label = 'MEDIUM' THEN 'CALCULATED_RISK'
    WHEN confidence_label = 'SPECULATIVE' THEN 'BOLD_PUNT'
    ELSE confidence_label
  END
  WHERE confidence_label IN ('HIGH', 'MEDIUM', 'SPECULATIVE');
