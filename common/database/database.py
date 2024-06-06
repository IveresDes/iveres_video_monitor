import logging
from datetime import datetime, timedelta, timezone
from pathlib import Path

from bson.objectid import ObjectId
from dotenv import dotenv_values
from pymongo import MongoClient

config = dotenv_values(Path(__file__).resolve().parent.parent.parent / ".env")

logging.basicConfig(
    format="[%(levelname)s|%(filename)s:%(lineno)s] %(asctime)s >> %(message)s",
    level=logging.DEBUG,
)

logger = logging.getLogger(__name__)

client = MongoClient(config["MONGO_URI"])
db = config["MONGO_DB"]


def get_watchlist_channels(platform):
    channels = client[db]["watchlist"].find({"platform": platform})
    return list(channels)


def save_video_request(request):
    # Reset request error status if any
    result = client[db]["requests"].update_one(
        {"url": request["url"], "userId": request["userId"], "status": "error"},
        {"$set": {"status": "requested", "errorMessage": ""}},
    )
    if result.matched_count == 1:
        return
    # Set or upsert request
    client[db]["requests"].update_one(
        {"url": request["url"], "userId": request["userId"]},
        {"$setOnInsert": request},
        upsert=True,
    )


def get_requested_videos(max_num=0):
    requests = client[db]["requests"].find(
        {"status": "requested"}, limit=max_num, sort=[("priority", -1)]
    )
    return list(requests)


def find_video_from_request_url(request_url):
    return client[db]["videos"].find_one({"requests.url": request_url})


def find_video_from_metadata(platform, video_id):
    video = client[db]["videos"].find_one(
        {"platform": platform, "platformMetadata.videoId": video_id}
    )
    return video


def set_request_error(request_id, error_message):
    return client[db]["requests"].update_one(
        {"_id": ObjectId(request_id)},
        {"$set": {"status": "error", "errorMessage": error_message}},
    )


def request_to_videorequest(request: dict):
    selected_keys = [
        "source",
        "userId",
        "url",
        "requestDatetime",
        "priority",
        "analysisEnabled",
    ]
    request = {k: v for k, v in request.items() if k in selected_keys}
    return request


def update_request(request, video, video_id):
    # Update requests with same url
    client[db]["requests"].update_many(
        {"url": request["url"]},
        {
            "$set": {
                "status": "downloaded",
                "errorMessage": "",
                "videoId": str(video_id),
            }
        },
    )

    # Update requested video
    matching_requests = client[db]["requests"].find({"url": request["url"]})
    video_requests = [request_to_videorequest(req) for req in matching_requests]
    # Change status to waiting only if analysis was disabled and is requested
    analysis_status = {
        analysis_type: (
            "waiting"
            if (
                analysis_status == "disabled"
                and any(req["analysisEnabled"][analysis_type] for req in video_requests)
            )
            else analysis_status
        )
        for analysis_type, analysis_status in video["analysisStatus"].items()
    }
    # Update priority if a request has higher priority
    priority = max(video["priority"], *[req["priority"] for req in video_requests])
    client[db]["videos"].update_one(
        {"_id": ObjectId(video_id)},
        {
            "$addToSet": {"requests": {"$each": video_requests}},
            "$set": {"analysisStatus": analysis_status, "priority": priority},
        },
    )


def insert_video(video):
    return client[db]["videos"].insert_one(video)


def get_videos_to_analyze(max_num=0):
    videos = client[db]["videos"].find(
        {
            "$or": [
                {"analysisStatus.transcribe": "waiting"},
                {"analysisStatus.fake": "waiting"},
            ]
        },
        limit=max_num,
        sort=[("priority", -1)],
    )
    return list(videos)


def store_video_transcriptions(video_id: str, transcriptions):
    logger.debug(f"Update transcription for video: {video_id}")
    return client[db]["videos"].update_one(
        {"_id": ObjectId(video_id)},
        {
            "$set": (
                {
                    "status": "transcribed",
                    "analysisStatus.transcribe": "error",
                }
                if transcriptions is None
                else {
                    "status": "transcribed",
                    "analysisStatus.transcribe": "done",
                    "extractedMetadata.transcriptions": transcriptions,
                }
            )
        },
    )


def store_video_fakes(video_id: str, deepware_res, polimi_res):
    logger.debug(f"Updating fakes for video: {video_id}")
    return client[db]["videos"].update_one(
        {"_id": ObjectId(video_id)},
        {
            "$set": {
                "status": "analyzed",
                "analysisStatus.fake": "done",
                "extractedMetadata.fakes.deepware": deepware_res,
                "extractedMetadata.fakes.polimi": polimi_res,
            }
        },
    )


def store_image_fakes(media_id: str, organika_res):
    logger.debug(f"Updating fakes for media: {media_id}")
    return client[db]["videos"].update_one(
        {"_id": ObjectId(media_id)},
        {
            "$set": {
                "status": "analyzed",
                "analysisStatus.fake": "done",
                "extractedMetadata.fakes.organika": organika_res,
            }
        },
    )


def get_latest_platform_videos(max_num=0):
    videos = client[db]["videos"].find(
        {"platform": {"$ne": "file"}}, limit=max_num, sort=[("priority", -1)]
    )
    return list(videos)


def set_video_status(video_id: str, status: str):
    client[db]["videos"].update_one(
        {"_id": ObjectId(video_id)}, {"$set": {"status": status}}
    )
    logger.debug(f"Updated status for video: {video_id}")


def get_old_unarchived_videos(old_time_delta: timedelta):
    max_datetime = datetime.now(timezone.utc) - old_time_delta
    max_datetime_str = max_datetime.isoformat()
    videos = client[db]["videos"].find(
        {
            "status": {"$ne": "archived"},
            "downloadDatetime": {"$lt": max_datetime_str},
        }
    )
    return list(videos)


if __name__ == "__main__":
    videos = get_videos_to_analyze(3)
    print(videos)
