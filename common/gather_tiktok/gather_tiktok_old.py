import logging
from datetime import datetime, timedelta, timezone
from time import sleep

from tiktokapipy.api import TikTokAPI, TikTokAPIError

from common.database.database import get_watchlist_channels, save_video_request

logging.basicConfig(
    format="[%(levelname)s|%(filename)s:%(lineno)s] %(asctime)s >> %(message)s",
    level=logging.DEBUG,
)

logger = logging.getLogger(__name__)


def users_videos_urls_generator(
    users_id,
    time_back: timedelta = timedelta(weeks=1),
    max_videos_back: int = 0,
    sleep_user=1.0,
    sleep_video=0.1,
):
    start_datetime = datetime.now(timezone.utc) - time_back

    with TikTokAPI() as api:
        for user_id in users_id:
            logger.info(f"Getting videos for user {user_id} up to {start_datetime}")
            try:
                user = api.user(user_id, video_limit=max_videos_back)
            except Exception:
                logger.exception(f"Error getting user {user_id}")
                continue
            videos = iter(user.videos)
            while True:
                try:
                    video = next(videos)
                    if video.create_time < start_datetime:
                        break
                    yield (
                        user_id,
                        f"https://www.tiktok.com/@{user.unique_id}/video/{video.id}",
                    )
                except StopIteration:
                    break
                except TikTokAPIError:
                    # Temporary fix so that the iterator does not get stuck if an error
                    # occurs on tiktokapipy -> api.py -> LightIter:90
                    user.videos._next_up += 1
                    logger.exception(f"Error getting video for user {user_id}")
                except Exception:
                    logger.exception(f"Error getting video for user {user_id}")
                logger.debug(f"Video gathered for {user_id}")
                sleep(sleep_video)
            logger.info(f"Videos gathered for user {user_id}")
            sleep(sleep_user)


def gather_tiktok(
    time_back: timedelta = timedelta(weeks=1), max_videos_back: int = 100
):
    channels = get_watchlist_channels("tiktok")
    channel_monitoring_users = {
        account["channelId"]: account["monitoringUsers"] for account in channels
    }
    channels_id = list(channel_monitoring_users.keys())
    channels_urls = users_videos_urls_generator(channels_id, time_back, max_videos_back)
    for channel_id, video_url in channels_urls:
        for user in channel_monitoring_users[channel_id]:
            request = {
                "source": "tiktokMonitor",
                "userId": user["userId"],
                "url": video_url,
                "requestDatetime": datetime.now(timezone.utc).isoformat(),
                "priority": 0,
                "status": "requested",
                "errorMessage": "",
                "videoId": None,
                "analysisEnabled": {"transcribe": True, "fake": False},
            }
            save_video_request(request)


if __name__ == "__main__":
    gather_tiktok(timedelta(days=0))
