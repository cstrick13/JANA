from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import whisper
import tempfile
import os
import requests

app = Flask(__name__)
CORS(app)

# Load Whisper model
print("Loading Whisper model...")
model = whisper.load_model("base")

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'audio' not in request.files:
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        audio_file.save(tmp.name)
        transcription = model.transcribe(tmp.name)
        os.unlink(tmp.name)  # Clean up the temp file

    return jsonify({"transcription": transcription["text"]})

@app.route('/tts', methods=['POST'])
def tts():
    """
    Receives text, sends it to the Coqui TTS container, returns audio data to the client.
    """
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'No text provided'}), 400

    text_to_speak = data['text']

    # Example: Send text to Coqui TTS container at port 5002
    # Adjust the URL to match your TTS container's actual endpoint
    coqui_url = 'http://coqui-tts:5002/api/tts'  # If inside Docker network
    # Or if testing locally: 'http://localhost:5002/api/tts'

    # Pass text as JSON (depends on how your TTS container expects data)
    response = requests.post(coqui_url, json={'text': text_to_speak})

    if response.status_code != 200:
        return jsonify({'error': 'TTS request failed'}), 500

    # The TTS container is expected to return raw audio or some audio stream
    audio_data = response.content

    # Return as an audio file (e.g. WAV) with the proper mime type
    return Response(
        audio_data,
        mimetype='audio/wav'
    )

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
