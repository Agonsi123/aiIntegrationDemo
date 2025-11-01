import express from "express";
import axios from "axios";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

// List of disallowed or banned keywords
const BANNED_KEYWORDS = ["kill", "hack", "bomb", "terror", "attack"];

// Helper Functions
// function to check if text contains banned keywords
function containsBannedWords(text) {
    const lower = text.toLowerCase();
    return BANNED_KEYWORDS.some((word) => lower.includes(word));
}

// Function to Redact banned words
function redactBannedWords(text) {
    let result = text;
    for (const word of BANNED_KEYWORDS) {
        const regex = new RegExp(word, "gi");
        result = result.replace(regex, "[REDACTED]");
    }
    return result;
}

// AI Request Logic
async function getAIResponse(systemPrompt, userPrompt) {
    const response = await axios.post(
        OPENROUTER_API_URL,
        {
            model: "minimax/minimax-m2:free",
            messages: [
                { role: "system", content: systemPrompt },
                {role: "user", content: userPrompt },
            ],
        },
        {
            headers: {
                Authorization: `Bearer ${OPENROUTER_API_KEY}`,
                "HTTP-Referer": "http://localhost",
                "X-Title": "Integration Demo",
                "Content-Type": "application/json",
            },
        }
    );
    return response.data.choices[0].message.content;
}

// API Endpoint

app.post("/generate", async (req, res) => {
    const { userPrompt } = req.body;

    const systemPrompt = "You are a friendly, concise AI assitant. Avoid generating unsafe or violent content.";

    // step 1: Input moderation
    if (containsBannedWords(userPrompt)) {
        return res.status(400).json({
            error: "Your input violated the moderation policy.",
        });
    }
    try {
        // Step 2: Call the AI model
        const aiResponse = await getAIResponse(systemPrompt, userPrompt);

        // Step3: Output moderation
        if (containsBannedWords(aiResponse)) {
            const safeResponse = redactBannedWords(aiResponse);
            return res.json({
                moderated: true,
                message: "Some content was redacted for safety.",
                response: safeResponse,
            });
        }

        // Step 4: Return clean response
        res.json({ moderated: false, response: aiResponse});
    } catch (err) {
        console.error("Error:", err.response?.data || err.message);
        res.status(500).json({error: "AI request failed."});
    }
});

// Start server
const PORT = 5000;
app.listen(PORT, () => console.log(`Server running at http://localhost:${PORT}`));