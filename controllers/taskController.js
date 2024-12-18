const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const router = express.Router();

// Initialize Supabase
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

router.patch('/users/complete-task/:telegramId/:taskId', async (req, res) => {
    const { telegramId, taskId } = req.params;

    try {
        // Log incoming data for debugging
        console.log('Telegram ID:', telegramId);
        console.log('TaskId:', taskId)

        // Check if the task has already been completed by the user
        const { data: existingTask, error: fetchError } = await supabase
            .from('user_tasks')
            .select('completed')
            .eq('telegramId', telegramId)
            .eq('task_id', taskId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            // Handle fetch error (skip 116 which means no data found)
            console.error('Error fetching task status:', fetchError);
            return res.status(500).json({ error: 'Error fetching task status' });
        }

        // If the task has already been completed, return early
        if (existingTask && existingTask.completed) {
            return res.status(400).json({ message: 'Task already completed' });
        }

        // If no record exists, insert a new entry
        const { error: insertError } = await supabase
            .from('user_tasks')
            .insert({
                telegramId,
                task_id: taskId,
                completed: true,
                completed_at: new Date()
            });

        if (insertError) {
            console.error('Error inserting task completion:', insertError);
            return res.status(500).json({ error: 'Error inserting task completion' });
        }

        res.status(200).json({ message: 'Task marked as completed' });
    } catch (err) {
        console.error('Unexpected error:', err);
        return res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

router.get('/users/task-status/:telegramId/:taskId', async (req, res) => {
    const { telegramId, taskId } = req.params;

    try {
        // Fetch the task completion and claimed status for the given user and task
        const { data: taskStatus, error: fetchError } = await supabase
            .from('user_tasks')
            .select('completed, claimed')
            .eq('telegramId', telegramId)
            .eq('task_id', taskId)
            .single();

        if (fetchError && fetchError.code !== 'PGRST116') {
            console.error('Error fetching task status:', fetchError);
            return res.status(500).json({ error: 'Error fetching task status' });
        }

        if (!taskStatus) {
            // If no record is found, return a 404 response
            return res.status(404).json({ message: 'Task not found for this user' });
        }

        // Return the completion and claimed status
        res.status(200).json({ completed: taskStatus.completed, claimed: taskStatus.claimed });
    } catch (err) {
        console.error('Unexpected error:', err);
        return res.status(500).json({ error: 'An unexpected error occurred' });
    }
});

router.get('/users/task-statuses/:telegramId', async (req, res) => { 
    const { telegramId } = req.params;

    try {
        // Fetch all tasks for the specified user
        const { data: taskStatuses, error: fetchError } = await supabase
            .from('user_tasks')
            .select('task_id, completed, claimed')
            .eq('telegramId', telegramId);

        if (fetchError) {
            console.error('Error fetching all task statuses:', fetchError);
            return res.status(500).json({ error: 'Error fetching task statuses' });
        }

        if (!taskStatuses || taskStatuses.length === 0) {
            // If no tasks are found, return a 404 response
            return res.status(404).json({ message: 'No tasks found for this user' });
        }

        // Return the array of task statuses
        res.status(200).json(taskStatuses);
    } catch (err) {
        console.error('Unexpected error:', err);
        return res.status(500).json({ error: 'An unexpected error occurred' });
    }
});


module.exports = router;
