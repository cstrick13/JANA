from flask import Flask, request, jsonify, Response
from flask_cors import CORS
import whisper
import tempfile
import os
import requests
from kokoro_onnx import Kokoro
import soundfile as sf


app = Flask(__name__)
CORS(app)

# Load Whisper model
print("Loading Whisper model...")
model = whisper.load_model("base")

# Load Kokoro TTS model
print("Loading Kokoro TTS model...")
kokoro = Kokoro("kokoro-v1.0.onnx", "voices.bin")

# Available voices in the Kokoro model
available_voices = [
    'af_bella', 'af_nicole', 'af_sarah',
    'am_adam', 'am_michael',
    'bf_emma', 'bf_isabella',
    'bm_george', 'bm_lewis'
]

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
    data = request.get_json()
    print("Received /tts request:", data)  # Debugging log

    if not data or 'text' not in data:
        print("Error: No text provided")
        return jsonify({'error': 'No text provided'}), 400
    
    text_to_speak = data['text']
    speaker_id = data.get('speaker_id', 'af_bella')  # Default speaker

    if speaker_id not in available_voices:
        print(f"Error: Invalid speaker_id: {speaker_id}")
        return jsonify({'error': f'Invalid speaker_id. Available voices: {available_voices}'}), 400

    print(f"Generating TTS for: {text_to_speak} | Voice: {speaker_id}")

    try:
        samples, sample_rate = kokoro.create(text_to_speak, voice=speaker_id, speed=1.0)

        with tempfile.NamedTemporaryFile(delete=False, suffix=".wav") as tmp_wav:
            sf.write(tmp_wav.name, samples, sample_rate)
            audio_path = tmp_wav.name

        with open(audio_path, 'rb') as f:
            audio_data = f.read()

        os.unlink(audio_path)
        return Response(audio_data, mimetype='audio/wav')

    except Exception as e:
        print("Error in TTS generation:", str(e))
        return jsonify({'error': str(e)}), 500

# This is a test push to see if I nuked the repo after supposedly fixing the issue
# It did not even give me the prompt it just went ahead and did it

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)