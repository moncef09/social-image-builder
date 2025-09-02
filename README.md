# Social Media Image Builder

This project is a small demo of how generative AI can streamline content creation for social media. It allows you to describe a post, choose the mood and style, select background images, and then upload your product photo. Behind the scenes, a Node.js server orchestrates calls to Google Gemini to extract key elements, generate prompts and create a final composite image.

## ✨ Features

- **Agentic user flow** – The app asks two short follow‑up questions about mood and style using a simple state machine. These answers help tailor the backgrounds and final composition, making the experience feel interactive and personal.
- **Automatic element extraction** – Leveraging the Gemini API, the backend breaks your description down into search terms for finding relevant background images.
- **Image search & selection** – The frontend uses the Google Custom Search API to fetch candidate images not just for the overall mood, but also for each distinct element in your description (for example, if you mention “watermelon” the app will show different watermelon photos). You choose which reference image best fits your vision for every item.
- **AI‑generated composite** – Once you’ve selected backgrounds and uploaded a product photo, the server constructs a single detailed prompt and uses the Gemini image model to generate a photorealistic composition. The product’s appearance is preserved while the background reflects your chosen mood and style.
- **Modern, responsive UI** – Built with vanilla JavaScript and custom CSS, the interface uses a step‑by‑step layout, chat bubbles for the agentic questions, and clear calls to action.

## 🛠 Technology

- **Frontend:** HTML, CSS and JavaScript (no frameworks). The interface is structured into clear steps and uses flexbox/grid for layout.
- **Backend:** Node.js with Express. It manages the agentic flow, calls the Google Generative AI SDK, and serves as an API for the frontend.
- **AI services:** Google Gemini 1.5/2.5 models for text and image generation.
- **Search:** Google Custom Search API for retrieving background photos.

## 🚀 Getting Started

1. **Clone this repository**
   ```bash
   git clone https://github.com/moncef09/social-image-builder.git
   cd social-image-builder
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Create a `.env` file** in the project root with your API key:
   ```env
   GEMINI_API_KEY=your_google_ai_key_here
   ```

4. **Run the backend**
   ```bash
   node server.js
   ```
   The server listens on port 3000 by default.

5. **Open the frontend** by loading `index.html` in your browser. You can also serve it via a simple web server (e.g., `npx http-server`).

## 🧠 How It Works

1. **Describe your post** – Enter a short description like “a cozy coffee shop on a rainy day with a warm latte”.
2. **Answer the agent’s questions** – The app asks about mood (e.g., cozy, energetic) and style (e.g., pastel colors, black‑and‑white) to guide the search and composition.
3. **Select reference images** – For each extracted element (e.g., coffee shop interior, rainy window, watermelon), the app shows you multiple example photos. You choose the one that best matches the look or shape you want, or skip if none appeal.
4. **Upload your product** – Provide a photo of the product you want to feature (e.g., a mug). The server analyses it to include key details.
5. **Generate** – The backend assembles your inputs, selected reference images, and product photo into a single prompt and sends it to the Gemini image model. You receive a polished, photorealistic composite.

## 📄 License

This repository is provided for demonstration and educational purposes. Feel free to fork it and build upon it, but note that API usage may incur costs or be subject to terms of service.
