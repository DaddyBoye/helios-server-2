const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const router = express.Router();
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    throw new Error('Supabase URL and key must be provided.');
}

const supabase = createClient(supabaseUrl, supabaseKey);

// Function to generate a unique referral token
const generateReferralToken = (telegramId) => {
    const hash = crypto.createHash('sha256');
    const tokenString = `${telegramId}-${Date.now()}`; // Using current timestamp
    hash.update(tokenString);
    const hashedValue = hash.digest('hex');
    return `ref_${hashedValue.substring(0, 16)}`; // Concatenate 'ref_' and the first 16 characters of the hash
};

// Function to send a welcome message
const sendWelcomeMessage = async (chatId) => {
    const BOT_TOKEN = process.env.BOT_TOKEN || '7394104022:AAFbbeaeuGx0zUKPKejUTdrVgzvjVlnCDfo';
    const TELEGRAM_API_URL = `https://api.telegram.org/bot${BOT_TOKEN}/sendPhoto`;

    const imageUrl = 'https://i.imgur.com/w1oV4xH.jpeg'; // New image URL
    const message = `🎉 *Welcome to Helios!* 🌍\n\n` +
        `🌟 *Your journey towards impactful climate action begins here.*\n\n` +
        `🌱 *Complete daily missions and earn rewards*\n` +
        `💫 *Track your environmental progress*\n` +
        `💎 *Participate in exciting airdrops and events*\n\n` +
        `Together, we can create a sustainable future. Let's get started! ⚡️`;

    try {
        await axios.post(TELEGRAM_API_URL, {
            chat_id: chatId,
            photo: imageUrl,
            caption: message,
            parse_mode: 'Markdown',
        });
        console.log(`Welcome message sent to chat ID: ${chatId}`);
    } catch (error) {
        console.error('Error sending welcome message:', error.message);
    }
};

// Route to handle user creation
router.post('/user', async (req, res) => {
    const { telegramId, telegramUsername, firstName, lastName, referralToken, timezone } = req.body;

    // Validate telegramId
    if (!telegramId || typeof telegramId !== 'number') {
        return res.status(400).json({ error: 'Invalid telegramId, must be a number' });
    }

    // Validate timezone
    if (!timezone || typeof timezone !== 'string') {
        return res.status(400).json({ error: 'Invalid timezone, must be a string' });
    }

    try {
        // Check if user already exists
        let { data: user, error } = await supabase
            .from('users')
            .select('*')
            .eq('telegramId', telegramId)
            .single();

        if (error && error.code !== 'PGRST116') { // PGRST116 indicates no rows found
            console.error('Error fetching user:', error);
            throw new Error(error.message);
        }

        // If user doesn't exist, create a new one
        if (!user) {
            let referredBy = null;

            // If a referral token was provided, fetch the referrer’s telegramId
            if (referralToken) {
                const { data: referrerData, error: referrerError } = await supabase
                    .from('users')
                    .select('telegramId, referralCount, minerate') // Include referralCount in the selection
                    .eq('referralToken', referralToken)
                    .single();

                if (referrerError) {
                    console.error('Error fetching referrer:', referrerError.message);
                } else if (!referrerData) {
                    console.warn('No referrer found with referral token:', referralToken);
                } else {
                    referredBy = referrerData.telegramId; // Set the referrer’s telegramId
                    console.log('Referrer found with telegramId:', referredBy);
                }
            }

            const referralTokenGenerated = generateReferralToken(telegramId); 
            // Create the new user with the referredBy field and timezone
            const { data: newUser, error: createError } = await supabase
                .from('users')
                .insert([{ 
                    telegramId, 
                    telegramUsername, 
                    firstName, 
                    lastName, 
                    referralToken: referralTokenGenerated, 
                    referredBy, 
                    timezone,
                }])
                .select('*');

            if (createError) {
                console.error('Error creating user:', createError);
                throw new Error(createError.message);
            }

            user = newUser[0]; // Access the newly created user

            // Send a welcome message after user creation
            await sendWelcomeMessage(telegramId, firstName);

            // Log the referral if the referrer exists
            if (referredBy) {
                console.log(`Referrer ID found: ${referredBy}. Attempting to log referral...`);

                // Log the referral
                const { error: logReferralError } = await supabase
                    .from('referrals')
                    .insert({
                        referrerTelegramId: referredBy,
                        referredUserTelegramId: telegramId,
                        referredUsername: telegramUsername,
                        timestamp: new Date().toISOString()
                    });

                if (logReferralError) {
                    console.error('Error logging referral:', logReferralError.message);
                } else {
                    console.log(`Referral logged: Referrer ${referredBy} referred ${telegramId}`);

                    // Fetch the referrer's current referralCount
                    const { data: referrerData, error: referrerError } = await supabase
                        .from('users')
                        .select('referralCount, minerate, totalAirdrops')
                        .eq('telegramId', referredBy)
                        .single();

                    // Increment the referral count for the referrer
                    const currentReferralCount = referrerData.referralCount || 0; // Get current referral count
                    const newReferralCount = currentReferralCount + 1; // Increment by 1

                    // Increment the minerate for the referrer
                    const currentMinerate = referrerData.minerate || 0; // Get current minerate
                    const newMinerate = currentMinerate + 10; // Increase by 10

                    // Increment totalAirdrops for the referrer
                    const currentTotalAirdrops = referrerData.totalAirdrops || 0; // Get current totalAirdrops
                    const newTotalAirdrops = currentTotalAirdrops + 100; // Increase by 100

                    // Update referralCount, minerate, and totalAirdrops for the referrer in a single update
                    const { error: updateUserError } = await supabase
                        .from('users')
                        .update({ 
                            referralCount: newReferralCount, 
                            minerate: newMinerate, 
                            totalAirdrops: newTotalAirdrops 
                        })
                        .eq('telegramId', referredBy);

                    if (updateUserError) {
                        console.error('Error updating user data:', updateUserError.message);
                    }
                }
            }
        }

        return res.status(201).json({ user });
    } catch (error) {
        console.error('Error processing request:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Route to check if a user exists based on their telegramId
router.get('/user/exists/:telegramId', async (req, res) => {
    const { telegramId } = req.params;

    // Validate telegramId
    if (!telegramId || isNaN(telegramId)) {
        return res.status(400).json({ error: 'Invalid telegramId, must be a number' });
    }

    try {
        // Fetch the user by telegramId
        const { data: user, error } = await supabase
            .from('users')
            .select('id') // Select only the user ID for checking existence
            .eq('telegramId', telegramId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ exists: false, message: 'User not found' });
            } else {
                throw new Error(error.message);
            }
        }

        // If user exists, return exists: true
        return res.json({ exists: true });
    } catch (error) {
        console.error('Error checking user existence:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Route to handle creating a unique Helios username
router.post('/username', async (req, res) => {
    const { telegramId, heliosUsername } = req.body;

    // Validate inputs
    if (!telegramId || typeof telegramId !== 'number') {
        return res.status(400).json({ error: 'Invalid telegramId, must be a number' });
    }
    if (!heliosUsername || typeof heliosUsername !== 'string') {
        return res.status(400).json({ error: 'Invalid heliosUsername, must be a string' });
    }

    try {
        // Check if the username already exists
        const { data: existingUser, error: existingUserError } = await supabase
            .from('users')
            .select('*')
            .eq('heliosUsername', heliosUsername)
            .single();

        if (existingUser && existingUserError) {
            return res.status(400).json({ error: 'Username already taken' });
        }

        // If the username is available, update the user's record with the new Helios username
        const { error: updateError } = await supabase
            .from('users')
            .update({ heliosUsername })
            .eq('telegramId', telegramId);

        if (updateError) {
            console.error('Error updating username:', updateError);
            throw new Error(updateError.message);
        }

        return res.status(200).json({ message: 'Username created successfully', heliosUsername });
    } catch (error) {
        console.error('Error processing request:', error);
        return res.status(500).json({ error: error.message });
    }
});

// Route to check if a Helios username is available
router.post('/check-username', async (req, res) => {
    const { heliosUsername } = req.body;

    // Validate inputs
    if (!heliosUsername || typeof heliosUsername !== 'string') {
        return res.status(400).json({ error: 'Invalid heliosUsername, must be a string' });
    }

    try {
        // Check if the username already exists
        const { data: existingUser, error: existingUserError } = await supabase
            .from('users')
            .select('*')
            .eq('heliosUsername', heliosUsername)
            .single();

        // If an existing user is found, the username is taken
        if (existingUser) {
            return res.status(200).json({ available: false });
        }

        // If no user is found, the username is available
        return res.status(200).json({ available: true });
    } catch (error) {
        console.error('Error checking username availability:', error);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

router.get('/user/referral-token/:telegramId', async (req, res) => {
    const { telegramId } = req.params;

    // Validate telegramId
    if (!telegramId || isNaN(telegramId)) {
        return res.status(400).json({ error: 'Invalid telegramId, must be a number' });
    }

    try {
        // Fetch the user by telegramId
        const { data: user, error } = await supabase
            .from('users')
            .select('referralToken')
            .eq('telegramId', telegramId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'User not found' });
            } else {
                throw new Error(error.message);
            }
        }

        // Return the user's referral token
        res.json({ referralToken: user.referralToken });
    } catch (error) {
        console.error('Error fetching referral token:', error);
        res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});

// Route to fetch a Helios username based on telegramId
router.get('/user/helios-username/:telegramId', async (req, res) => {
    const { telegramId } = req.params;

    // Validate telegramId
    if (!telegramId || isNaN(telegramId)) {
        return res.status(400).json({ error: 'Invalid telegramId, must be a number' });
    }

    try {
        // Fetch the user's Helios username by telegramId
        const { data: user, error } = await supabase
            .from('users')
            .select('heliosUsername')
            .eq('telegramId', telegramId)
            .single();

        if (error) {
            if (error.code === 'PGRST116') { // No rows found
                return res.status(404).json({ error: 'User not found' });
            } else {
                throw new Error(error.message);
            }
        }

        // Return the user's Helios username
        return res.json({ heliosUsername: user.heliosUsername });
    } catch (error) {
        console.error('Error fetching Helios username:', error);
        return res.status(500).json({ error: 'Internal server error', details: error.message });
    }
});


module.exports = router;
