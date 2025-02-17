// backend/server.js
const express = require('express');
const cors = require('cors');
const { GoogleGenerativeAI } = require('@google/generative-ai');
require('dotenv').config();

const app = express();

app.use(cors({
    origin: 'http://localhost:4200',
    methods: ['POST'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

const apiKey = process.env['GEMINI_API_KEY'];
if (!apiKey) {
    console.error('GEMINI_API_KEY is not set in environment variables');
    process.exit(1);
}

const genAI = new GoogleGenerativeAI(apiKey);

// Store active chat sessions
const chatSessions = new Map();

app.post('/api/generate/initialize', async (req, res) => {
    try {
        const { prompt } = req.body;
        const model = genAI.getGenerativeModel({ model: 'gemini-pro' });
        
        // Initialize chat with correctly structured history
        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: `${prompt}.The data provided is a an HTML element, Data can be a complex tables.
                        Summarize data and answer specific to the question.
                        give only specific data and provide details only if requested.
                         Give data in bullet points whenever possible. 
                         Offer additional context or explanations for the data in the HTML table.
                         If asked to give data as a Bar Graph, Pie Chart, or Line Chart, Give the specif HTML to Generate graph for the content asked. This will be added as an InnerHTML of a div in UI.
                         IMPORTANT: elaborate only when asked` }]
                },
                {
                    role: "model",
                    parts: [{ text: "I understand. I'll use this context for future questions. What would you like to know?" }]
                }
            ],
            generationConfig: {
                temperature: 0.7,
                topK: 40,
                topP: 0.95,
                maxOutputTokens: 1024,
            }
        });

        // Generate session ID
        const sessionId = Date.now().toString(36) + Math.random().toString(36).substr(2);
        
        // Store chat session
        chatSessions.set(sessionId, chat);
        
        // Send initial response
        const result = await chat.sendMessage("Acknowledge that you've received the context.");
        const response = await result.response;

        res.json({ 
            sessionId,
            text: response.text()
        });
    } catch (error) {
        console.error('Error initializing chat:', error);
        res.status(500).json({ error: 'Failed to initialize chat' });
    }
});

app.post('/api/generate/chat', async (req, res) => {
    try {
        const { sessionId, query } = req.body;
        const chat = chatSessions.get(sessionId);
        
        if (!chat) {
            return res.status(400).json({ 
                error: 'Chat session not found. Please initialize a new chat.' 
            });
        }

        // Send message using correctly structured format
        const result = await chat.sendMessage([{ text: query }]);
        const response = await result.response;
        
        res.json({ 
            text: response.text(),
            sessionId
        });
    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Failed to generate response' });
    }
});

const PORT = process.env['PORT'] || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
