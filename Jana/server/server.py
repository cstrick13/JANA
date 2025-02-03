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
    Receives text and an optional speaker_id, sends it to the Coqui TTS container, 
    and returns audio data to the client.
    """
    data = request.get_json()
    if not data or 'text' not in data:
        return jsonify({'error': 'No text provided'}), 400
    print("DEBUG /tts route got data:", data)


    text_to_speak = data['text']

    # If the client doesn't provide a speaker_id, default to "p225"
    speaker_id = data.get('speaker_id', 'p363')  

    # Adjust the URL if your TTS container runs elsewhere
    coqui_url = 'http://localhost:5002/api/tts'

    # Pass text (and speaker_id) as JSON
    print("Sending text to TTS:", text_to_speak)
    print("Using speaker_id:", speaker_id)

    # If your model also needs language_id or other fields, add them similarly:
    #   language_id = data.get('language_id', 'en')
    #   payload = {'text': text_to_speak, 'speaker_id': speaker_id, 'language_id': language_id}
    #   response = requests.post(coqui_url, json=payload)

    payload = {"text": text_to_speak, "speaker_id": "p363"}
    response = requests.post(coqui_url, data=payload)

    if response.status_code != 200:
        return jsonify({'error': 'TTS request failed'}), 500

    # Return raw audio data as WAV
    audio_data = response.content
    return Response(audio_data, mimetype='audio/wav')


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)