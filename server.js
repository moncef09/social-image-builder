// server.js (FINAL VERSION)

// Load environment variables if dotenv is available. This prevents the server from crashing if
// the 'dotenv' module is not installed. Instead, it will simply rely on existing
// environment variables.
try {
    require('dotenv').config();
} catch (e) {
    console.warn('dotenv module not found; continuing without loading .env file');
}
const express = require('express');
const cors = require('cors');
// IMPORTANT: Using the SDK version that matches your code snippet
const { GoogleGenAI } = require("@google/genai"); 
const multer = require('multer');

const app = express();
const port = 3000;

const upload = multer({ storage: multer.memoryStorage() });
app.use(cors());
app.use(express.json());

// Initialize the GenAI client, it will automatically use the API key from .env
const genAI = new GoogleGenAI(process.env.GEMINI_API_KEY);

// --- Agentic flow state machine ---
// A simple state machine to collect mood and style preferences from the user.
// In a real LangGraph implementation, you could use a graph library to orchestrate
// more complex flows. This implementation keeps it lightweight while still
// illustrating an agentic conversation.
const AGENT_FLOW = {
    initial: {
        prompt: "Great! To better understand your vision, what mood or theme would you like for the image? (e.g., cozy, energetic, minimalist, adventurous)",
        next: 'mood',
    },
    mood: {
        prompt: "Do you have a preferred color palette or visual style? (e.g., warm tones, pastel colors, black-and-white)",
        next: 'style',
    },
    style: {
        prompt: (state) => {
            // Summarize the collected info
            const { mood, style } = state;
            return `Perfect! We'll craft an image that conveys a ${mood} mood with a ${style} style. Let's move on to selecting backgrounds!`;
        },
        next: 'end',
    },
};

// Endpoint to handle the agentic conversation flow
app.post('/agentic-flow', (req, res) => {
    try {
        const { state, answer } = req.body;
        // If no state provided, we are at the beginning of the flow
        if (!state || !state.node) {
            return res.json({ state: { node: 'mood' }, message: AGENT_FLOW.initial.prompt, done: false });
        }
        // Process according to current node
        if (state.node === 'mood') {
            // Save mood and ask about style
            const mood = typeof answer === 'string' ? answer.trim() : '';
            return res.json({ state: { node: 'style', mood }, message: AGENT_FLOW.mood.prompt, done: false });
        }
        if (state.node === 'style') {
            const style = typeof answer === 'string' ? answer.trim() : '';
            const mood = state.mood;
            const message = typeof AGENT_FLOW.style.prompt === 'function' ? AGENT_FLOW.style.prompt({ mood, style }) : AGENT_FLOW.style.prompt;
            return res.json({ state: { node: 'end', mood, style }, message, done: true });
        }
        // default fallback if flow is complete
        return res.json({ state, message: 'The flow is already finished.', done: true });
    } catch (error) {
        console.error('Agentic flow error:', error);
        res.status(500).json({ error: 'Agentic flow internal error.' });
    }
});

// Endpoint 1: Generate search elements (No changes)
app.post('/generate-elements', async (req, res) => {
    try {
        const { prompt } = req.body;
        if (!prompt) return res.status(400).json({ error: 'Prompt is required.' });
        
        // Using the newer SDK syntax here is fine as it's a different model
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI2 = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const textModel = genAI2.getGenerativeModel({ model: 'gemini-1.5-flash' });

        const instruction = `You are a creative assistant. Analyze a description and extract key visual elements for Google Image search. Respond with ONLY a valid JSON array of strings. Example: "A cozy coffee shop on a rainy day." -> ["cozy coffee shop interior", "rainy day view from window"]. User description: "${prompt}"`;
        const result = await textModel.generateContent(instruction);
        const text = await result.response.text();
        const jsonResponse = JSON.parse(text.replace(/```json|```/g, '').trim());
        res.json({ elements: jsonResponse });
    } catch (error) { console.error('Error generating elements:', error); res.status(500).json({ error: 'Failed to generate elements.' }); }
});


// NEW Endpoint 2: Creates the final image
app.post('/create-final-image', upload.array('productPhotos', 1), async (req, res) => {
    try {
        const { originalPrompt, selectedUrls, agentDetails } = req.body;
        const productImage = req.files[0];
        if (!productImage) return res.status(400).json({ error: "A product photo is required." });

        // --- Step A: Engineer the perfect prompt ---
        const { GoogleGenerativeAI } = require('@google/generative-ai');
        const genAI2 = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
        const textModel = genAI2.getGenerativeModel({ model: 'gemini-1.5-flash' });
        
        const productDescriptionPrompt = "Describe this product image in vivid, photorealistic detail for an AI image generator. Focus on material, shape, and key features.";
        const imagePart = { inlineData: { data: productImage.buffer.toString("base64"), mimeType: productImage.mimetype }};
        const descriptionResult = await textModel.generateContent([productDescriptionPrompt, imagePart]);
        const productDescription = await descriptionResult.response.text();

        // Parse the agent details if provided (mood and style)
        let mood = '';
        let style = '';
        try {
            if (agentDetails) {
                const parsed = typeof agentDetails === 'string' ? JSON.parse(agentDetails) : agentDetails;
                mood = parsed.mood || '';
                style = parsed.style || '';
            }
        } catch (err) {
            console.warn('Could not parse agent details:', err);
        }
        const finalPromptInstruction = `Create a single, detailed, photorealistic image generation prompt. Combine: 1. The concept: "${originalPrompt}". 2. The product: ${productDescription}. 3. The mood/setting from these themes: ${selectedUrls}. Also incorporate the following preferences: mood - ${mood}; style - ${style}. Generate only the final prompt paragraph. Also include a big important notice saying do not change the product appearance!`;
        const finalPromptResult = await textModel.generateContent(finalPromptInstruction);
        const finalImagePrompt = await finalPromptResult.response.text();

        console.log("Final engineered prompt:", finalImagePrompt);

        // --- Step B: Generate the image using the user's specified model ---
        const response = await genAI.models.generateContent({
            model: "gemini-2.5-flash-image-preview",
            contents: [{ parts: [{ text: finalImagePrompt }] }], // Structure contents correctly
        });

        let imageData = null;
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData) {
                imageData = part.inlineData.data;
                break; // Found the image, no need to loop further
            }
        }
        
        if (imageData) {
            res.json({ imageData: imageData }); // Send base64 image data back to the browser
        } else {
            throw new Error("Image generation failed, no image data received.");
        }

    } catch (error) {
        console.error('Error in final image creation:', error);
        res.status(500).json({ error: 'Failed to create final image.' });
    }
});


app.listen(port, () => {
    console.log(`Server is running at http://localhost:${port}`);
});