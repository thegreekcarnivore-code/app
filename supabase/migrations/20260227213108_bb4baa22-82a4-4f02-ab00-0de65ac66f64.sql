
-- Shift all recipe images: recipe with sort_order N should use day-(N+1).jpg
-- because currently day-01.jpg (assigned to sort_order=1) actually belongs to sort_order=2's food
-- So sort_order=1 needs day-02... wait, the shift is the other way:
-- day-01.jpg shows recipe 2's food, so recipe 1 should get a LATER image
-- Actually: all images are shifted -1 from where they should be
-- Fix: recipe N should now use day-(N+1).jpg to shift forward by 1
UPDATE recipes SET image_url = '/recipes/day-' || LPAD((sort_order + 1)::text, 2, '0') || '.jpg'
WHERE sort_order <= 24;

-- Recipe 25 wraps to day-01.jpg (which was the "extra" first image)
UPDATE recipes SET image_url = '/recipes/day-01.jpg'
WHERE sort_order = 25;

-- Recipes 26-30 don't have images, leave as-is
