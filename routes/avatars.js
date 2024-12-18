const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and key must be provided.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Route to update the user's avatar
router.post('/user/avatar', async (req, res) => {
    const { telegramId, avatarPath } = req.body;

    // Validate inputs
    if (!telegramId || typeof telegramId !== 'number') {
        return res.status(400).json({ error: 'Invalid telegramId, must be a number' });
    }
    if (!avatarPath || typeof avatarPath !== 'string') {
        return res.status(400).json({ error: 'Invalid avatar path, must be a string' });
    }

    try {
        // Update the user's avatar in the database
        const { error } = await supabase
            .from('users')
            .update({ avatarPath }) // Assumes a column named 'avatarPath' in your 'users' table
            .eq('telegramId', telegramId);

        if (error) {
            throw error;
        }

        return res.status(200).json({ message: 'Avatar updated successfully' });
    } catch (error) {
        console.error('Error updating avatar:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Route to get a user's avatar path
router.get('/user/avatar/:telegramId', async (req, res) => {
    const { telegramId } = req.params;

    // Validate telegramId
    if (!telegramId || isNaN(telegramId)) {
        return res.status(400).json({ error: 'Invalid telegramId, must be a number' });
    }

    try {
        // Fetch the user's avatarPath from the database
        const { data: user, error } = await supabase
            .from('users')
            .select('avatarPath')
            .eq('telegramId', telegramId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'User not found' });
            } else {
                throw new Error(error.message);
            }
        }

        // Return only the avatar path, no URL construction
        return res.status(200).json({ avatarPath: user.avatarPath });
    } catch (error) {
        console.error('Error fetching avatar path:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

module.exports = router;
