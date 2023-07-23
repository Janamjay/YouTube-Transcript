const express = require("express");
const cors = require("cors");
const ytdl = require("ytdl-core");
const fs = require("fs");
const speech = require("@google-cloud/speech");
const path = require("path");

const app = express();
const client = new speech.SpeechClient();

app.use(cors());
app.use(express.json());

// Serve the React app's build files
app.use(express.static(path.join(__dirname, "../frontend/build")));

// API route for transcript generation
app.post("/api/transcript", async (req, res) => {
  const { url } = req.body;

  if (!url || !ytdl.validateURL(url)) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }

  try {
    const info = await ytdl.getInfo(url);
    const { title } = info.videoDetails;
    const videoStream = ytdl(url, { quality: "highestaudio" });
    const audioFilePath = path.join(__dirname, "audio.raw");

    videoStream.pipe(fs.createWriteStream(audioFilePath));

    videoStream.on("end", async () => {
      // Transcribe audio using Google Cloud Speech-to-Text
      const audio = fs.readFileSync(audioFilePath);
      const audioBytes = audio.toString("base64");
      const audioConfig = {
        encoding: "LINEAR16",
        sampleRateHertz: 16000,
        languageCode: "en-US",
      };
      const request = {
        audio: { content: audioBytes },
        config: audioConfig,
      };
      const [response] = await client.recognize(request);
      const transcription = response.results
        .map((result) => result.alternatives[0].transcript)
        .join("\n");

      // Delete temporary files
      fs.unlinkSync(audioFilePath);

      res.json({ transcript: transcription });
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Catch-all route to serve the React app
app.get("*", (req, res) => {
  res.sendFile(path.join(__dirname, "../frontend/build/index.html"));
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
