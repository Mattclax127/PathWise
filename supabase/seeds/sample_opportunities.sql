-- SAMPLE data for product preview. Every company below is FICTIONAL. Remove before launch (delete from public.opportunities where is_sample).
insert into public.opportunities (title, company_name, city, career_field, description) values
 ('Marketing intern (sample)', 'Sample Harbor Media', 'Miami', 'marketing', 'Fictional listing: social content and campaign reporting.'),
 ('Hospitality trainee (sample)', 'Sample Palm Hotels', 'Miami', 'hospitality', 'Fictional listing: front office and guest services rotation.'),
 ('Software intern (sample)', 'Sample Citrus Labs', 'Orlando', 'technology', 'Fictional listing: web application features and tests.'),
 ('Hospitality trainee (sample)', 'Sample Lakeside Resort', 'Orlando', 'hospitality', 'Fictional listing: food and beverage operations.'),
 ('Business operations intern (sample)', 'Sample Empire Partners', 'New York City', 'business', 'Fictional listing: analysis and process documentation.'),
 ('Design intern (sample)', 'Sample Loft Studio', 'New York City', 'design', 'Fictional listing: brand and layout work.'),
 ('Marketing trainee (sample)', 'Sample Lakefront Agency', 'Chicago', 'marketing', 'Fictional listing: email and analytics.'),
 ('Technology trainee (sample)', 'Sample Windy Systems', 'Chicago', 'technology', 'Fictional listing: support tooling and data checks.'),
 ('Design intern (sample)', 'Sample Sunset Creative', 'Los Angeles', 'design', 'Fictional listing: motion and print assets.')
on conflict do nothing;
