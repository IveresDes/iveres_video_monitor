import logging
from pathlib import Path

import pysubs2
import syntok.segmenter as segmenter
from faster_whisper import WhisperModel
from torch import cuda
from transformers import pipeline

logging.basicConfig(
    format="[%(levelname)s|%(filename)s:%(lineno)s] %(asctime)s >> %(message)s",
    level=logging.DEBUG,
)

logger = logging.getLogger(__name__)

models_path = Path(__file__).resolve().parent / "models"


def segments_to_sentences(segments, sentence_max_words=200):
    """Convert speech segments to speech sentences.

    Args:
        segments (list): Segments from speech to text model with format:
            [{start, end, text}, ...]
        sentence_max_words (int, optional): Maximum number of words per sentence. If a
          sentence is longer it will be split. Defaults to 200.

    Returns:
        list: Sentences with the same format as segments [{start, end, text}, ...]
    """

    segments = list(segments)

    # Prepare joint text and character to time map
    joint_text = ""
    char_to_time = []
    for seg in segments:
        joint_text += seg["text"]
        n = len(seg["text"])
        char_to_time.extend(
            [
                seg["start"] + (i / max(1, n - 1)) * (seg["end"] - seg["start"])
                for i in range(n)
            ]
        )
    if not joint_text.strip():
        return segments

    # Split joint text into sentences
    out_sentences = []
    for paragraph in segmenter.analyze(joint_text):
        for sentence in paragraph:
            # Ensure sentences do not have more tokens than sentence_max_words
            chunks = [
                sentence[i : i + sentence_max_words]
                for i in range(0, len(sentence), sentence_max_words)
            ]
            for chunk in chunks:
                start_token = chunk[0].offset - len(chunk[0].spacing)
                end_token = chunk[-1].offset + len(chunk[-1].value) - 1
                start = char_to_time[start_token]
                end = char_to_time[end_token]
                text = "".join(token.spacing + token.value for token in chunk)
                out_sentences.append({"start": start, "end": end, "text": text})

    return out_sentences


def create_en_es_transcribe_translate(
    trancribe_source=False,
    whisper_model_path=None,
    translation_model_path=None,
    device: str = None,
):
    """Create a function to trascribe and translate video.

    Args:
        trancribe_source (bool, optional): Option to transcribe in the source language.
            Defaults to False.
        whisper_model_path (str, optional): Whisper model. If None it will try to load
            first from a local model ("large-v2") and then from the default cache
            system. Defaults to None.
        translation_model_path (str, optional): Translation model. If None it will try
            to load first from a local model ("Helsinki-NLP/opus-mt-en-es") and then
            from the default cache system. Defaults to None.
        device (str, optional): Models device to use. With format "cuda:0" or "cpu".
            Defaults to None.

    Returns:
        Function to process a video.
    """

    if whisper_model_path is None:
        model = "large-v2"
        local_model = models_path / model
        whisper_model_path = str(local_model) if local_model.exists() else model
    if translation_model_path is None:
        model = "Helsinki-NLP/opus-mt-en-es"
        local_model = models_path / model
        translation_model_path = str(local_model) if local_model.exists() else model

    if device is None:
        wh_device_idx = 0
        if cuda.is_available():
            wh_device, tr_device = "cuda", "cuda:0"
        else:
            wh_device, tr_device = "cpu", "cpu"
    else:
        if ":" in device:
            wh_device, wh_device_idx = device.split(":")
            wh_device_idx = int(wh_device_idx)
            tr_device = device
        else:
            wh_device_idx = 0
            wh_device, tr_device = device, device

    whisper_model = WhisperModel(
        whisper_model_path,
        device=wh_device,
        device_index=wh_device_idx,
        compute_type="float16",
    )

    translator = pipeline("translation", translation_model_path, device=tr_device)

    def process_video(video_file):
        """Function to transcribe and translate video.

        Args:
            video_file: Video file to transcribe and translate.

        Returns:
            dict: Results dict with format:
            {
                "srcLang": "es",
                "data": {
                    "es": {
                        "type": "transcribe",
                        "language": "es"
                        "text": "All the text"
                        "segments": [
                            {"start": 0.1, "end": 2.3, "text": "Segment text"},
                            ...
                        ]
                    },
                    "en": {
                        "type": "speechTranslate",
                        "language": "en"
                        "text": "All the text"
                        "segments": [
                            {"start": 0.1, "end": 2.3, "text": "Segment text"},
                            ...
                        ]
                    }
                }
            }
        """

        # Transcribe
        transcriptions = {}

        # Auto detect language from the first 30s
        src_lang = None

        if trancribe_source:
            # Whisper transcribe source language
            logger.debug("Running speech transcribe")
            src_segments, src_info = whisper_model.transcribe(
                str(video_file),
                task="transcribe",
                language=src_lang,
                initial_prompt=",.!?",
                vad_filter=True,
            )
            src_lang = src_info.language
            src_segments = [
                {"start": seg.start, "end": seg.end, "text": seg.text}
                for seg in src_segments
            ]
            transcriptions[src_lang] = {
                "type": "transcribe",
                "language": src_lang,
                "text": "".join(seg["text"] for seg in src_segments),
                "segments": src_segments,
            }

        if "en" not in transcriptions:
            # Whisper translate to en
            logger.debug("Running speech translate")
            en_segments, en_info = whisper_model.transcribe(
                str(video_file),
                task="translate",
                language=src_lang,
                initial_prompt=",.!?",
                vad_filter=True,
            )
            src_lang = en_info.language
            en_segments = [
                {"start": seg.start, "end": seg.end, "text": seg.text}
                for seg in en_segments
            ]
            transcriptions["en"] = {
                "type": "speechTranslate",
                "language": en_info.language,
                "text": "".join(seg["text"] for seg in en_segments),
                "segments": en_segments,
            }

        if "es" not in transcriptions:
            # Translate from english text
            logger.debug("Running text translate")
            # Join segments by sentences to improve downstream translation
            segments_en = segments_to_sentences(transcriptions["en"]["segments"])
            translated_segments = []
            for seg in segments_en:
                text_es = translator(seg["text"], truncation=True)[0][
                    "translation_text"
                ]
                translated_segments.append(
                    {"start": seg["start"], "end": seg["end"], "text": " " + text_es}
                )

            transcriptions["es"] = {
                "type": "textTranslate",
                "language": "es",
                "text": "".join(seg["text"] for seg in translated_segments),
                "segments": translated_segments,
            }

        return {"srcLang": src_lang, "data": transcriptions}

    return process_video


def write_result_files(result, files_dir, files_name):
    txt_file = Path(files_dir, files_name).with_suffix(".txt")
    srt_file = Path(files_dir, files_name).with_suffix(".srt")
    vtt_file = Path(files_dir, files_name).with_suffix(".vtt")

    with open(txt_file, "w") as txt_io:
        txt_io.writelines(seg["text"] + "\n" for seg in result["segments"])

    subs = pysubs2.whisper.load_from_whisper(result)
    subs.save(str(srt_file))
    subs.save(str(vtt_file))

    return {"txt": txt_file, "srt": srt_file, "vtt": vtt_file}


def write_transcription_files(transcription_result, video_file, videos_dir):
    video_file = Path(video_file).absolute()
    videos_dir = Path(videos_dir).absolute()
    vid_out_dir = str(video_file.parent)
    video_name = video_file.stem

    transcription_files = {}
    for lang, lang_result in transcription_result["data"].items():
        files_base_name = f"{video_name}-{lang}"
        lang_files = write_result_files(lang_result, vid_out_dir, files_base_name)
        transcription_files[lang] = {
            ext: str(Path(file).relative_to(videos_dir))
            for ext, file in lang_files.items()
        }
    return transcription_files


if __name__ == "__main__":
    process_video = create_en_es_transcribe_translate(
        trancribe_source=True, device="cuda:0"
    )

    video_file = "data/test/test_user/test.mp4"
    transcription_result = process_video(video_file)
    files = write_transcription_files(transcription_result, video_file, "data/test")
