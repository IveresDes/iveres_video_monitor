source envs/env_transcribe/bin/activate
python -c 'import faster_whisper; faster_whisper.download_model("large-v3", "common/transcription/models/large-v3")'
python -c 'from huggingface_hub import snapshot_download; snapshot_download("Helsinki-NLP/opus-mt-en-es", local_dir="common/transcription/models/Helsinki-NLP/opus-mt-en-es")'
