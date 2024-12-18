const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Add or update a rating for a project
router.post('/ratings', async (req, res) => {
    const { project_id, telegramId, rating, comment } = req.body;

    if (rating < 1 || rating > 5) {
        return res.status(400).json({ error: 'Rating must be between 1 and 5.' });
    }

    // Log incoming rating data
    console.log('Incoming rating data:', req.body);

    try {
        // First, check if the rating already exists
        const { data: existingRating, error: selectError } = await supabase
            .from('ratings')
            .select('id')
            .eq('project_id', project_id)
            .eq('telegramId', telegramId)
            .maybeSingle(); // Use maybeSingle to handle the case of no result

        if (selectError) {
            console.error('Error checking for existing rating:', selectError);
            return res.status(500).json({ error: 'Failed to check existing rating' });
        }

        if (existingRating) {
            // If the rating already exists, update it
            const { data, error } = await supabase
                .from('ratings')
                .update({ rating, comment })
                .eq('id', existingRating.id)
                .select();  // Add `.select()` to ensure we return the updated row

            if (error) {
                console.error('Error updating rating:', error);
                return res.status(500).json({ error: 'Failed to update rating' });
            }

            // Log successful rating update
            console.log('Rating successfully updated:', data);
            return res.status(200).json(data); // Return the updated data
        } else {
            // If the rating doesn't exist, insert a new one
            const { data, error } = await supabase
                .from('ratings')
                .insert([{ project_id, telegramId, rating, comment }])
                .select();  // Add `.select()` to ensure we return the inserted row

            if (error) {
                console.error('Error adding rating:', error);
                return res.status(500).json({ error: 'Failed to add rating' });
            }

            // Log successful rating insertion
            console.log('Rating successfully added:', data);
            return res.status(201).json(data); // Return the inserted data
        }
    } catch (err) {
        console.error('Unexpected error:', err);
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

// Get all ratings for a project
router.get('/ratings/:projectId', async (req, res) => {
    const { projectId } = req.params;

    try {
        const { data: ratings, error } = await supabase
            .from('ratings')
            .select('rating, comment, telegramId')
            .eq('project_id', projectId);

        if (error) {
            console.error('Error fetching ratings:', error);
            return res.status(500).json({ error: 'Failed to fetch ratings' });
        }

        // Manually calculate average rating
        const totalRatings = ratings.reduce((sum, rating) => sum + rating.rating, 0);
        const averageRating = totalRatings / ratings.length;

        // Log successful retrieval of ratings and average rating
        console.log('Ratings retrieved successfully for projectId:', projectId);
        console.log('Average Rating:', averageRating);

        res.status(200).json({ ratings, averageRating });
    } catch (err) {
        console.error('Unexpected error:', err);
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

module.exports = router;
