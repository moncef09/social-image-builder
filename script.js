// --- CONFIGURATION ---
// ⚠️ PASTE YOUR GOOGLE API KEY AND CX ID HERE
const GOOGLE_API_KEY = 'AIzaSyBwmaX1VunJgUv2-YD7jSKbb3xQkIS90J0';
const GOOGLE_CX = 'a48291e18283c4e0f';


// --- DOM ELEMENTS ---
const promptInput = document.getElementById('prompt-input');
const startBtn = document.getElementById('start-btn');
const skipBtn = document.getElementById('skip-btn');
const statusText = document.getElementById('status-text');
const suggestionsGrid = document.getElementById('suggestions-grid');
const finalSelectionsGrid = document.getElementById('final-selections');

// New DOM elements for chat & images sections
const chatSection = document.getElementById('chat-section');
const chatContainer = document.getElementById('chat-container');
const chatInput = document.getElementById('chat-input');
const sendBtn = document.getElementById('send-btn');
const imagesSection = document.getElementById('images-section');

// DOM Elements for the final step
const generationArea = document.getElementById('generation-area');
const productPhotoInput = document.getElementById('product-photo-input');
const generateImageBtn = document.getElementById('generate-image-btn');
const finalImageDisplay = document.getElementById('final-image-display');

// --- STATE MANAGEMENT ---
let elements = [];
let currentElementIndex = 0;
let selectedImageUrls = [];
let agentState = null;
let agentDetails = {};

// --- EVENT LISTENERS ---
startBtn.addEventListener('click', startImageGenerationProcess);
skipBtn.addEventListener('click', skipCurrentElement);
generateImageBtn.addEventListener('click', createFinalImage);
sendBtn.addEventListener('click', handleChatSend);

// Allow pressing Enter in the prompt input to trigger the start button
promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        startBtn.click();
    }
});

// Allow pressing Enter in the chat input to send a chat message
chatInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendBtn.click();
    }
});

// --- LOGIC ---

/**
 * Kicks off the entire process when the user clicks "Generate".
 * It calls the server to break the prompt down into searchable elements.
 */
async function startImageGenerationProcess() {
    const prompt = promptInput.value.trim();
    if (!prompt) {
        alert('Please enter a description for your post.');
        return;
    }

    // Reset UI and state for a new run
    currentElementIndex = 0;
    selectedImageUrls = [];
    agentState = null;
    agentDetails = {};
    suggestionsGrid.innerHTML = '';
    finalSelectionsGrid.innerHTML = '';
    finalImageDisplay.innerHTML = '';
    // Hide subsequent steps initially
    imagesSection.classList.add('hidden');
    generationArea.classList.add('hidden');
    chatSection.classList.add('hidden');
    skipBtn.classList.add('hidden');

    startBtn.textContent = 'Restart';
    startBtn.disabled = true;
    statusText.textContent = '🧠 Analyzing your description...';

    try {
        // Step 1: ask server to break down the prompt into elements
        const response = await fetch('http://localhost:3000/generate-elements', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        });
        if (!response.ok) throw new Error('Failed to get elements from the server.');
        const data = await response.json();
        elements = data.elements || [];

        // Step 2: start agentic flow for mood/style
        chatContainer.innerHTML = '';
        chatSection.classList.remove('hidden');
        chatInput.disabled = false;
        sendBtn.disabled = false;

        // Request the first question from the server (no state or answer)
        const agentRes = await fetch('http://localhost:3000/agentic-flow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({}),
        });
        if (!agentRes.ok) throw new Error('Agentic flow error.');
        const agentData = await agentRes.json();
        agentState = agentData.state;
        appendChatMessage('assistant', agentData.message);

        statusText.textContent = '';
    } catch (error) {
        console.error('Error:', error);
        statusText.textContent = '😔 Something went wrong. Please try again.';
    } finally {
        startBtn.disabled = false;
    }
}

/**
 * Fetches background/mood images from Google Search for the current element.
 */
async function fetchImagesForCurrentElement() {
    if (currentElementIndex >= elements.length) {
        displayFinalResults();
        return;
    }

    const currentElement = elements[currentElementIndex];
    statusText.textContent = `⏳ Searching for: "${currentElement}"...`;
    suggestionsGrid.innerHTML = '';
    const url = `https://www.googleapis.com/customsearch/v1?key=${GOOGLE_API_KEY}&cx=${GOOGLE_CX}&q=${encodeURIComponent(currentElement)}&searchType=image&num=9`;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Google Search API error.');
        
        const data = await response.json();
        if (!data.items || data.items.length === 0) {
            statusText.textContent = `😕 No results found for "${currentElement}". Skipping.`;
            setTimeout(skipCurrentElement, 1500); 
            return;
        }
        displayImageSuggestions(data.items);
    } catch (error) {
        console.error("Error fetching images:", error);
        statusText.textContent = `😔 Could not fetch images. Check your Google Search API Key/CX ID.`;
    }
}

/**
 * Displays the fetched image suggestions for the user to select.
 * @param {Array} images - An array of image objects from the Google Search API.
 */
function displayImageSuggestions(images) {
    statusText.textContent = `👇 Select an image for: "${elements[currentElementIndex]}"`;
    suggestionsGrid.innerHTML = '';
    images.forEach(image => {
        const imgElement = document.createElement('img');
        imgElement.src = image.image.thumbnailLink;
        imgElement.alt = image.snippet;
        imgElement.title = `Click to select this image for "${elements[currentElementIndex]}"`;
        imgElement.addEventListener('click', () => handleImageSelection(image.link));
        suggestionsGrid.appendChild(imgElement);
    });
}

/**
 * Handles the user clicking on a suggested image.
 * @param {string} selectedUrl - The URL of the image the user clicked.
 */
function handleImageSelection(selectedUrl) {
    selectedImageUrls.push(selectedUrl);
    const finalImg = document.createElement('img');
    finalImg.src = selectedUrl;
    finalSelectionsGrid.appendChild(finalImg);
    skipCurrentElement(); // Move to the next element
}

/**
 * Skips the current element and moves to the next one.
 */
function skipCurrentElement() {
    currentElementIndex++;
    fetchImagesForCurrentElement();
}

/**
 * Called when all background images have been selected/skipped.
 * It shows the final UI section for image generation.
 */
function displayFinalResults() {
    statusText.textContent = "✅ Elements selected! Now for the final step.";
    suggestionsGrid.innerHTML = '';
    skipBtn.classList.add('hidden');
    startBtn.textContent = 'Start Over';
    // Reveal the final generation section
    generationArea.classList.remove('hidden');
}

/**
 * Handles the final step: sending all data to the server to create the new image.
 */
async function createFinalImage() {
    const productPhoto = productPhotoInput.files[0];
    if (!productPhoto) {
        alert('Please select one product photo to continue.');
        return;
    }

    finalImageDisplay.innerHTML = '🎨 Generating your masterpiece... This can take a moment!';
    generateImageBtn.disabled = true;

    const formData = new FormData();
    formData.append('originalPrompt', promptInput.value);
    // Send search terms for context (elements array) as before
    formData.append('selectedUrls', JSON.stringify(elements));
    // Send the actual image URLs chosen by the user for each element
    formData.append('selectedImageUrls', JSON.stringify(selectedImageUrls));
    formData.append('productPhotos', productPhoto);
    formData.append('agentDetails', JSON.stringify(agentDetails));

    try {
        const response = await fetch('http://localhost:3000/create-final-image', {
            method: 'POST',
            body: formData,
        });
        if (!response.ok) throw new Error('Failed to create image from the server.');

        const data = await response.json();
        
        // Create an image element from the base64 data returned by the server
        const imageUrl = `data:image/png;base64,${data.imageData}`;
        finalImageDisplay.innerHTML = `<img src="${imageUrl}" alt="AI Generated Image">`;

    } catch (error) {
        console.error('Final image creation error:', error);
        finalImageDisplay.textContent = '😔 Sorry, an error occurred while creating the image.';
    } finally {
        generateImageBtn.disabled = false;
    }
}

/**
 * Appends a chat message bubble to the chat container.
 * @param {string} sender - either 'user' or 'assistant'
 * @param {string} text - the message content
 */
function appendChatMessage(sender, text) {
    const messageEl = document.createElement('div');
    messageEl.classList.add('chat-message', sender);
    messageEl.textContent = text;
    chatContainer.appendChild(messageEl);
    // scroll to bottom
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

/**
 * Handles sending a message in the agentic chat flow.
 * It posts the current state and user answer to the server and displays the response.
 */
async function handleChatSend() {
    const userInput = chatInput.value.trim();
    if (!userInput) return;
    // display user's message
    appendChatMessage('user', userInput);
    chatInput.value = '';
    try {
        const payload = { state: agentState, answer: userInput };
        const response = await fetch('http://localhost:3000/agentic-flow', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (!response.ok) throw new Error('Agentic flow error');
        const data = await response.json();
        // update state
        agentState = data.state;
        // display assistant message
        appendChatMessage('assistant', data.message);
        // if flow is finished
        if (data.done) {
            // store details for final prompt (mood and style)
            agentDetails = {
                mood: agentState.mood || '',
                style: agentState.style || '',
            };
            // disable chat input
            chatInput.disabled = true;
            sendBtn.disabled = true;
            // proceed to images step or skip if no elements
            if (elements && elements.length > 0) {
                imagesSection.classList.remove('hidden');
                skipBtn.classList.remove('hidden');
                fetchImagesForCurrentElement();
            } else {
                // No elements to search, jump directly to final generation step
                displayFinalResults();
            }
        }
    } catch (error) {
        console.error('Agentic flow error:', error);
        appendChatMessage('assistant', '😔 Sorry, something went wrong while processing your response.');
    }
}