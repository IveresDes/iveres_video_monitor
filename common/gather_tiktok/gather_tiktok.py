import json
import logging
import os
import tempfile
from datetime import datetime, timedelta, timezone
from time import sleep

from playwright.sync_api import sync_playwright
from playwright_stealth import stealth_sync

from common.database.database import get_watchlist_channels, save_video_request

logging.basicConfig(
    format="[%(levelname)s|%(filename)s:%(lineno)s] %(asctime)s >> %(message)s",
    level=logging.DEBUG,
)

logger = logging.getLogger(__name__)


# Funcion adaptada de ANTONIO JOSE EXPOSITO MARIN
def tiktokmonitor(channel_url: str):
    channel_id = channel_url.strip("/").split("/")[-1].strip("@")
    with sync_playwright() as playwright:
        # Abrir navegador y descargar las peticiones de red en un .har temporal. Devuelve el nombre del archivo creado para posterior procesamiento.
        temp_file = tempfile.NamedTemporaryFile(delete=False, prefix="tiktok_har-")
        browser = playwright.firefox.launch()  # headless=False)
        # ESTE ES EL PUNTO DE PARTIDA: CAPTURAR TODAS LAS LLAMADAS DE RED QUE SE HACEN POR DETRÁS Y GUARDARLAS EN UN ARCHIVO.
        browser_context = browser.new_context(record_har_path=temp_file.name)
        page = browser_context.new_page()
        stealth_sync(page)  # aplicar ofuscación para evitar ser detectado como bot
        page.goto(channel_url)
        # Esperar a recibir todas las llamadas de red
        try:
            page.wait_for_load_state("networkidle", timeout=5000)
        except Exception:
            logger.debug(f"networkidle timeout for {channel_url}")
        browser_context.close()
        browser.close()
        har = json.load(temp_file)
        try:
            os.remove(temp_file.name)
        except Exception:
            pass

        # DE ENTRE TODAS LAS RESPUESTAS, CAPTURAR AQUELLAS QUE CONTENGAN WebIdLastTime (llamada interna a la API de TikTok)
        out2 = [
            x["response"]
            for x in har["log"]["entries"]
            if x["request"]["url"].find("WebIdLastTime") > -1
        ]

        # EXTRAER LISTADO DE RESPONSES QUE TIENEN INFORMACIÓN SOBRE VÍDEOS (de momento, funciona buscando la cadena 'coverLarger' en el texto de las 'entries.content.text'; se pueden probar otros filtrados más precisos como, por ejemplo, primero comprobar si existe el campo text, parsear el json y buscar algún campo concreto)
        listados = [
            o["content"]["text"]
            for o in out2
            if o["content"].get("text") and "itemList" in o["content"]["text"]
        ]

        if not listados:
            return []

        # SUELEN RECUPERARSE ENTRE 2 Y 3 LISTADOS. ME QUEDO CON EL SEGUNDO. COMPROBAR EL NÚMERO DE RESULTADOS DEVUELTOS Y ELEGIR EL PRIMERO O EL SEGUNDO.
        d1 = json.loads(listados[0])

        # quitar los vídeos fijados (son los 3 primeros vídeos que aparecen en la portada del usuarios y que pueden ser antiguos):
        items = [x for x in d1["itemList"] if "isPinnedItem" not in x.keys()]

        # quitar videos que no sean del mismo canal
        items = [
            x
            for x in items
            if channel_id in {x["author"]["uniqueId"], x["author"]["id"]}
        ]

        # EXTRAIGO EL LISTADO DE VÍDEOS
        # FORMATEAR EL RESULTADO PARA CADA VÍDEO: id de vídeo, fecha de creación, link, etc.
        videos = [
            {
                "id": x["id"],
                "createTime": x["createTime"],
                "ts": datetime.fromtimestamp(x["createTime"], timezone.utc),
                "user": x["author"]["uniqueId"],
                "userId": x["author"]["id"],
                "videoDesc": x["desc"],
            }
            for x in items
        ]
        videos = sorted(videos, key=lambda x: x["createTime"], reverse=True)

    return videos


def users_videos_urls_generator(
    users_id,
    time_back: timedelta = timedelta(weeks=1),
    max_videos_back: int = None,
    sleep_user=1.0,
):
    start_datetime = datetime.now(timezone.utc) - time_back

    for user_id in users_id:
        logger.info(f"Getting videos for user {user_id} up to {start_datetime}")
        try:
            channel_url = f"https://www.tiktok.com/@{user_id}"
            videos = tiktokmonitor(channel_url)
            for video in videos[:max_videos_back]:
                if video["ts"] < start_datetime:
                    logger.info(f"Start datetime reached with video {video['id']}")
                    break
                logger.debug(f"Video gathered for {user_id} with id {video['id']}")
                yield (
                    user_id,
                    f"https://www.tiktok.com/@{user_id}/video/{video['id']}",
                )
        except Exception:
            logger.exception(f"Error getting videos for user {user_id}")
            continue

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
    gather_tiktok(timedelta(days=1))
