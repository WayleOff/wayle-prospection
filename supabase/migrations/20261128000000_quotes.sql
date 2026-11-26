-- Étape f : devis. Date de validité et notes propres à chaque devis.
alter table quotes add column if not exists valid_until date;
alter table quotes add column if not exists notes text;
