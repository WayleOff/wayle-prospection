-- Données de départ et de démonstration (15 prospects rouennais FICTIFS).
-- Noms, comptes Instagram et adresses e-mail sont inventés ; les numéros de téléphone sont dans les
-- plages réservées à la fiction (à ma connaissance : 02 61 91 xx xx et 06 39 98 xx xx).
-- À retirer en production : delete from prospects where id in (select prospect_id from prospect_tags
-- join tags on tags.id = tag_id where tags.name = 'démo');

insert into stages (name, position, kind, color) values
  ('À contacter', 1, 'open', '#71717a'),
  ('Contacté', 2, 'open', '#3b82f6'),
  ('Répondu', 3, 'open', '#8b5cf6'),
  ('RDV / Tournage prévu', 4, 'open', '#f59e0b'),
  ('Reel livré', 5, 'open', '#06b6d4'),
  ('Gagné', 6, 'won', '#16a34a'),
  ('Perdu', 7, 'lost', '#dc2626');

insert into categories (name, default_tone, is_priority, position) values
  ('Restaurant', 'tu', true, 1), ('Café / bar', 'tu', true, 2), ('Hôtel / gîte', 'vous', false, 3),
  ('Commerce', 'tu', true, 4), ('PME', 'vous', false, 5), ('Cabinet de recrutement', 'vous', false, 6),
  ('Agence de communication', 'vous', false, 7), ('Créateur de contenu', 'tu', false, 8),
  ('Artiste / musicien', 'tu', false, 9);

insert into tags (name, color) values ('démo', '#a1a1aa'), ('ouverture récente', '#f59e0b'), ('à visiter', '#3b82f6');

insert into prospects (name, category_id, stage_id, heat, preferred_channel, address, district, lat, lng, instagram, phone, email,
                       contact_first_name, contact_last_name, opened_on, source, est_amount_cents, highlights, ig_activity,
                       next_action_label, next_action_at, score)
select v.name, c.id, s.id, v.heat::heat_level, v.channel::channel_t, v.address, v.district::district_t, v.lat, v.lng, v.instagram, v.phone, v.email,
       v.first_name, v.last_name, v.opened_on, v.source, v.amount, v.highlights, v.ig::ig_activity_t,
       v.next_label, current_date + v.next_in, v.score
from (values
  ('Le Comptoir des Marées', 'Restaurant', 'À contacter', 'cold', 'instagram', '12 rue Eau-de-Robec, 76000 Rouen', 'rive_droite', 49.4438, 1.1046, '@demo.comptoir.marees', '02 61 91 00 01', 'contact@comptoir-marees.example.org', 'Camille', 'Roux', date '2026-09-15', 'Balade rue Eau-de-Robec', 9000, 'Ouverture récente, carte courte de poissons, jolie vaisselle bleue', 'low', 'Premier DM Instagram', 0, 78),
  ('Atelier Pomme & Cannelle', 'Café / bar', 'À contacter', 'cold', 'visit', '5 rue Martainville, 76000 Rouen', 'rive_droite', 49.4425, 1.1081, '@demo.pomme.cannelle', '02 61 91 00 02', null, 'Inès', 'Lambert', date '2026-06-02', 'Recommandation', 9000, 'Salon de thé, pâtisseries maison, déco bois clair', 'inactive', 'Passer en boutique', 1, 71),
  ('Hôtel du Vieux Port (démo)', 'Hôtel / gîte', 'À contacter', 'cold', 'email', '8 quai de la Bourse, 76000 Rouen', 'rive_droite', 49.4389, 1.0924, null, '02 61 91 00 03', 'direction@hotel-vieux-port.example.org', 'Monsieur', 'Fournier', null, 'Google Maps', 45000, 'Façade du quai, vue sur la Seine, petit-déjeuner servi dans la cour', null, 'Envoyer un e-mail', 0, 55),
  ('Boutique Fil & Aiguille', 'Commerce', 'Contacté', 'warm', 'instagram', '21 rue Cauchoise, 76000 Rouen', 'rive_droite', 49.4452, 1.0871, '@demo.fil.aiguille', '06 39 98 00 04', null, 'Margaux', 'Petit', date '2026-03-10', 'Instagram', 9000, 'Créatrice de vêtements, ateliers couture le samedi', 'low', 'Relance courte', 2, 66),
  ('Bar à Vins Les Trois Clés', 'Café / bar', 'Contacté', 'warm', 'instagram', '3 place du Vieux-Marché, 76000 Rouen', 'rive_droite', 49.4433, 1.0885, '@demo.trois.cles', '02 61 91 00 05', null, 'Théo', 'Morel', date '2026-10-01', 'Instagram', 9000, 'Soirées dégustation du jeudi, cave voûtée', 'active', 'Relance courte', 3, 62),
  ('Studio Yoga Respire', 'Commerce', 'Contacté', 'cold', 'phone', '14 rue Jeanne d''Arc, 76000 Rouen', 'rive_droite', 49.4461, 1.0937, '@demo.yoga.respire', '06 39 98 00 06', null, 'Laura', 'Garnier', date '2026-08-20', 'Recommandation', 9000, 'Cours en petit groupe, lumière naturelle', 'low', 'Appeler', 1, 58),
  ('Maison Delaunay Traiteur', 'Restaurant', 'Répondu', 'hot', 'email', '9 rue Saint-Romain, 76000 Rouen', 'rive_droite', 49.4408, 1.0956, '@demo.delaunay.traiteur', '02 61 91 00 07', 'bonjour@delaunay-traiteur.example.org', 'Julien', 'Delaunay', date '2025-11-12', 'Google Maps', 9000, 'Buffets de mariage, livraison en vélo cargo', 'low', 'Proposer le reel d''essai', 0, 84),
  ('Cabinet Horizon RH', 'Cabinet de recrutement', 'Répondu', 'warm', 'linkedin', '2 rue de la République, 76000 Rouen', 'rive_droite', 49.4379, 1.0951, null, '02 61 91 00 08', 'contact@horizon-rh.example.org', 'Sophie', 'Marchand', null, 'LinkedIn', 120000, 'Vidéos de présentation des équipes à créer', null, 'Échange de 10 minutes', 2, 49),
  ('Café Sous les Toits', 'Café / bar', 'RDV / Tournage prévu', 'hot', 'visit', '17 rue Damiette, 76000 Rouen', 'rive_droite', 49.4396, 1.1029, '@demo.sous.les.toits', '06 39 98 00 09', null, 'Anaïs', 'Girard', date '2026-05-04', 'Visite', 9000, 'Terrasse sur les toits, brunch du dimanche', 'low', 'Tournage du reel d''essai', 4, 82),
  ('Chambres d''hôtes La Pie Voleuse', 'Hôtel / gîte', 'RDV / Tournage prévu', 'warm', 'email', '6 rue de Fontenelle, 76000 Rouen', 'rive_droite', 49.4467, 1.1011, '@demo.pie.voleuse', '02 61 91 00 10', 'reservation@pie-voleuse.example.org', 'Brigitte', 'Colin', date '2024-04-01', 'Recommandation', 45000, 'Maison à colombages, jardin intérieur', 'inactive', 'Repérage', 5, 60),
  ('Pizzeria Il Faro', 'Restaurant', 'Reel livré', 'hot', 'phone', '30 rue Saint-Sever, 76100 Rouen', 'rive_gauche', 49.4294, 1.0817, '@demo.ilfaro', '02 61 91 00 11', null, 'Marco', 'Benedetti', date '2025-02-14', 'Visite', 9000, 'Four à bois visible depuis la salle, pâte étalée à la main', 'low', 'Présenter le reel', 0, 88),
  ('Studio Lumière & Cie', 'Agence de communication', 'Reel livré', 'warm', 'email', '4 rue Raymond Poincaré, 76100 Rouen', 'rive_gauche', 49.4261, 1.0903, '@demo.lumiere.cie', '02 61 91 00 12', 'hello@lumiere-cie.example.org', 'Valérie', 'Dupuis', null, 'LinkedIn', 60000, 'Sous-traitance vidéo pour leurs clients', 'active', 'Relance après livraison', 2, 52),
  ('Garage Pop & Roule', 'PME', 'Gagné', 'hot', 'phone', '45 avenue des Canadiens, 76300 Sotteville-lès-Rouen', 'rive_gauche', 49.4119, 1.0850, null, '02 61 91 00 13', 'accueil@pop-roule.example.org', 'Étienne', 'Vasseur', date '2023-09-01', 'Recommandation', 120000, 'Garage indépendant, voitures de collection', null, null, null, 72),
  ('Léa Corsaire', 'Créateur de contenu', 'Gagné', 'hot', 'instagram', null, null, null, null, '@demo.lea.corsaire', null, 'lea@corsaire.example.org', 'Léa', 'Corsaire', null, 'Instagram', 90000, 'Vidéos de voyage, abonnés en croissance', 'active', null, null, 69),
  ('Les Frères Vallée (rap)', 'Artiste / musicien', 'Perdu', 'cold', 'instagram', null, null, null, null, '@demo.freres.vallee', null, null, 'Hugo', 'Vallée', null, 'Instagram', 30000, 'Clip prévu, budget trop serré', 'active', null, null, 40)
) as v(name, category, stage, heat, channel, address, district, lat, lng, instagram, phone, email, first_name, last_name, opened_on,
       source, amount, highlights, ig, next_label, next_in, score)
join categories c on c.name = v.category
join stages s on s.name = v.stage;

update prospects set lost_reason = 'Budget trop serré pour cette année' where name = 'Les Frères Vallée (rap)';

insert into prospect_tags (prospect_id, tag_id)
select p.id, t.id from prospects p cross join tags t where t.name = 'démo';
insert into prospect_tags (prospect_id, tag_id)
select p.id, t.id from prospects p join tags t on t.name = 'ouverture récente'
where p.name in ('Le Comptoir des Marées', 'Bar à Vins Les Trois Clés');
insert into prospect_tags (prospect_id, tag_id)
select p.id, t.id from prospects p join tags t on t.name = 'à visiter'
where p.name in ('Atelier Pomme & Cannelle', 'Hôtel du Vieux Port (démo)');

-- Quelques lignes d'historique pour que les fiches ne soient pas vides.
insert into activities (prospect_id, kind, channel, body, created_at)
select p.id, a.kind::activity_kind, a.channel::channel_t, a.body, now() - a.ago
from prospects p join (values
  ('Maison Delaunay Traiteur', 'message', 'email', 'Premier e-mail envoyé : portfolio et proposition de reel d''essai.', interval '6 days'),
  ('Maison Delaunay Traiteur', 'reply', 'email', 'Réponse : intéressé, demande combien de temps dure le tournage.', interval '2 days'),
  ('Maison Delaunay Traiteur', 'stage_change', null, 'Contacté → Répondu', interval '2 days'),
  ('Pizzeria Il Faro', 'visit', 'visit', 'Visite sur place, très bon accueil, tournage fait mardi.', interval '9 days'),
  ('Pizzeria Il Faro', 'note', null, 'Veut un montage plus rythmé pour les stories.', interval '3 days'),
  ('Café Sous les Toits', 'call', 'phone', 'Appel : rendez-vous fixé pour le tournage.', interval '4 days'),
  ('Boutique Fil & Aiguille', 'message', 'instagram', 'DM envoyé : compliment sur les ateliers et proposition de reel.', interval '3 days')
) as a(name, kind, channel, body, ago) on a.name = p.name;
