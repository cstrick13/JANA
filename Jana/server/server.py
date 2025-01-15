from flask import Flask, request, jsonify
from flask_cors import CORS
import whisper
import tempfile
import os

app = Flask(__name__)
CORS(app)

# Load Whisper model
print("Loading Whisper model...")
model = whisper.load_model("base")

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'audio' not in request.files:
        print("No audio file provided")
        return jsonify({"error": "No audio file provided"}), 400

    audio_file = request.files['audio']
    with tempfile.NamedTemporaryFile(delete=False) as tmp:
        audio_file.save(tmp.name)
        transcription = model.transcribe(tmp.name)
        print("Transcription: " + transcription["text"])
        os.unlink(tmp.name)  # Clean up the temp file

    return jsonify({"transcription": transcription["text"]})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)
