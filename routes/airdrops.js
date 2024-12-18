const express = require('express');
require('dotenv').config();
const router = express.Router();
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client with environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and key must be provided.');
}
const supabase = createClient(supabaseUrl, supabaseKey);

// API Route for fetching a user's airdrops
router.get('/airdrops/:telegramId', async (req, res) => {
    const { telegramId } = req.params;

    try {
        const { data, error } = await supabase
            .from('airdrops')
            .select('*') // Fetch all columns (or specify specific columns)
            .eq('telegramId', telegramId);

        if (error) {
            console.error('Error fetching airdrops:', error);
            return res.status(500).json({ message: 'Internal server error' });
        }

        return res.status(200).json(data);
    } catch (error) {
        console.error('Error in fetching airdrops:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// API Route to delete all airdrops for a specific user and reset airdrop counts
router.delete('/airdrops/delete/:telegramId', async (req, res) => {
    const { telegramId } = req.params; // Get telegramId from request parameters

    try {
        // Delete all airdrops for the user
        const { error: deleteError } = await supabase
            .from('airdrops')
            .delete()
            .eq('telegramId', telegramId);

        if (deleteError) throw new Error('Error deleting airdrops');

        // Reset the airdropClaimCount and unclaimedAirdropTotal to zero
        const { error: resetError } = await supabase
            .from('users')
            .update({
                airdropClaimCount: 0, // Reset the claim count
                unclaimedAirdropTotal: 0,
                messageIndex: 0, // Reset the unclaimed total
            })
            .eq('telegramId', telegramId); // Ensure this matches the identifier in your users table

        if (resetError) throw new Error('Error resetting airdrop counts');

        return res.status(200).json({ message: 'All airdrops deleted and counts reset successfully' });
    } catch (error) {
        console.error('Error deleting airdrops:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// API Route to get airdrop claim count for a specific user
router.get('/airdrops/count/:telegramId', async (req, res) => {
    const { telegramId } = req.params;

    try {
        // Fetch the user's airdropClaimCount from the users table
        const { data: user, error } = await supabase
            .from('users')
            .select('airdropClaimCount')
            .eq('telegramId', telegramId)
            .single(); // Get a single user record

        if (error || !user) {
            console.error('Error fetching user airdrop claim count:', error);
            return res.status(404).json({ message: 'User not found' });
        }

        return res.status(200).json({ count: user.airdropClaimCount });
    } catch (error) {
        console.error('Error fetching airdrop claim count:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// API Route to get the sum of airdrop values for a specific user
router.get('/airdrops/sum/:telegramId', async (req, res) => {
    const { telegramId } = req.params;

    try {
        // Query to get the sum of all airdrop values for the user
        const { data, error } = await supabase
            .from('airdrops')
            .select('value')
            .eq('telegramId', telegramId);

        if (error) throw new Error('Error fetching airdrop values');

        // Calculate the sum of the values
        const totalValue = data.reduce((sum, airdrop) => sum + airdrop.value, 0);

        return res.status(200).json({ totalValue });
    } catch (error) {
        console.error('Error fetching airdrop values:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// API Route to get the sum of airdrop values and update total airdrops for a specific user
router.get('/airdrops/sum/update/:telegramId', async (req, res) => {
    const { telegramId } = req.params;

    try {
        // Fetch the sum of all airdrop values for the user
        const { data, error } = await supabase
            .from('airdrops')
            .select('value')
            .eq('telegramId', telegramId);

        if (error) throw new Error('Error fetching airdrop values');

        // Calculate the sum of the values
        const totalValue = data.reduce((sum, airdrop) => sum + airdrop.value, 0);

        // Fetch the current total airdrops from the users table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('totalAirdrops')
            .eq('telegramId', telegramId)
            .single(); // Use single to get one record

        if (userError) throw new Error('Error fetching user total airdrops');

        const currentTotalAirdrops = userData.totalAirdrops || 0; // Default to 0 if undefined

        // Update the user's total airdrops in the users table
        const newTotalAirdrops = currentTotalAirdrops + totalValue;

        const { error: updateError } = await supabase
            .from('users')
            .update({ totalAirdrops: newTotalAirdrops }) // Update to new total
            .eq('telegramId', telegramId); // Ensure this matches the identifier in your users table

        if (updateError) throw new Error('Error updating total airdrops');

        return res.status(200).json({ totalValue, newTotalAirdrops });
    } catch (error) {
        console.error('Error fetching and updating airdrop values:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// API Route to get total airdrops for a specific user
router.get('/airdrops/total/:telegramId', async (req, res) => {
    const { telegramId } = req.params;

    try {
        // Fetch the current total airdrops from the users table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('totalAirdrops')  // Fetch the totalAirdrops column
            .eq('telegramId', telegramId)
            .single();  // Fetch one user based on telegramId

        if (userError) throw new Error('Error fetching total airdrops');

        // Respond with the total airdrops value
        const totalAirdrops = userData.totalAirdrops || 0;  // Default to 0 if undefined

        return res.status(200).json({ totalAirdrops });
    } catch (error) {
        console.error('Error fetching total airdrops:', error);
        return res.status(500).json({ message: 'Internal server error' });
    }
});

// API Route to increase airdrops based on task points and mark the task as completed
router.post('/airdrops/increase/:telegramId/:taskId', async (req, res) => {
    const { telegramId, taskId } = req.params;
    const { taskPoints } = req.body;

    if (!taskPoints || isNaN(taskPoints)) {
        return res.status(400).json({ message: 'Invalid task points provided.' });
    }

    try {
        // Fetch the user's current airdrop count from the users table
        const { data: userData, error: userError } = await supabase
            .from('users')
            .select('totalAirdrops')
            .eq('telegramId', telegramId)
            .single();

        if (userError || !userData) {
            return res.status(404).json({ message: 'User not found.' });
        }

        const currentAirdrops = userData.totalAirdrops || 0;
        const newAirdropsTotal = currentAirdrops + taskPoints;

        // Update the user's total airdrops by adding the task points
        const { error: updateError } = await supabase
            .from('users')
            .update({ totalAirdrops: newAirdropsTotal })
            .eq('telegramId', telegramId);

        if (updateError) throw new Error('Error updating total airdrops.');

        // Check if the task has already been completed by the user
        const { data: existingTask, error: fetchError } = await supabase
            .from('user_tasks')
            .select('completed, claimed')
            .eq('telegramId', telegramId)
            .eq('task_id', taskId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching task status:', fetchError);
            return res.status(500).json({ error: 'Error fetching task status' });
        }

        console.log(`Initial task status - Completed: ${existingTask?.completed}, Claimed: ${existingTask?.claimed}`);

        if (existingTask) {
            // If the task exists, update the claimed status directly
            const { error: updateClaimError } = await supabase
                .from('user_tasks')
                .update({ claimed: true })
                .eq('telegramId', telegramId)
                .eq('task_id', taskId);

            if (updateClaimError) {
                console.error('Error updating claimed status:', updateClaimError);
                return res.status(500).json({ error: 'Error updating claimed status' });
            }
        } else {
            // Insert a new entry if no record exists
            const { error: insertError } = await supabase
                .from('user_tasks')
                .insert({
                    telegramId,
                    task_id: taskId,
                    completed: true,
                    claimed: true,
                    completed_at: new Date()
                });

            if (insertError) {
                console.error('Error inserting task completion:', insertError);
                return res.status(500).json({ error: 'Error inserting task completion' });
            }
        }

        // Log the updated task status
        console.log(`Updated task status - Completed: true, Claimed: true`);

        // Successful response
        res.status(200).json({
            message: 'Airdrops updated successfully and task marked as completed.',
            newAirdropsTotal
        });
    } catch (error) {
        console.error('Error processing request:', error);
        return res.status(500).json({ message: 'Internal server error.' });
    }
});

module.exports = router;
