import xml.etree.ElementTree as ET
import requests
import logging
from datetime import datetime

logger = logging.getLogger(__name__)


def get_user_last_videos_datetime(channel_id):
    videos_datetime = {}
    try:
        url = f"https://www.youtube.com/feeds/videos.xml?channel_id={channel_id}"
        r = requests.get(url)
        root = ET.fromstring(r.text)
        ns = {
            "yt": "http://www.youtube.com/xml/schemas/2015",
            "media": "http://search.yahoo.com/mrss/",
            "atom": "http://www.w3.org/2005/Atom",
        }
        for entry in root.findall("atom:entry", ns):
            video_id = entry.find("yt:videoId", ns).text
            published = datetime.fromisoformat(entry.find("atom:published", ns).text)
            videos_datetime[video_id] = published
    except Exception:
        logger.exception(f"Error getting video datetimes for channel {channel_id}")
    return videos_datetime


if __name__ == "__main__":
    user_last_videos_datetime = get_user_last_videos_datetime(
        "UCUS73_bjTYwBFAfXbvIjM8Q"
    )
    print(user_last_videos_datetime)
