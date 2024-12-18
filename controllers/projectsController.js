const express = require('express');
const { createClient } = require('@supabase/supabase-js');

const router = express.Router();

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// Add a new project
router.post('/projects', async (req, res) => {
    const { name, description, location, certification } = req.body;

    try {
        const { data, error } = await supabase
            .from('projects')
            .insert([{ name, description, location, certification }])
            .select('*') // Ensure to select all columns to return after insertion
            .single(); // Will return a single row after insert

        if (error) {
            console.error('Error adding project:', error);
            return res.status(500).json({ error: 'Failed to add project' });
        }

        res.status(201).json(data); // Return the inserted data
    } catch (err) {
        console.error('Unexpected error:', err);
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

// Get all projects
router.get('/projects', async (req, res) => {
    try {
        const { data, error } = await supabase.from('projects').select('*');

        if (error) {
            console.error('Error fetching projects:', error);
            return res.status(500).json({ error: 'Failed to fetch projects' });
        }

        res.status(200).json(data);
    } catch (err) {
        console.error('Unexpected error:', err);
        res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

module.exports = router;
