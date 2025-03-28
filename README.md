# IVERES monitoring

## Description

This repository contains the code for the monitoring and video+image fake detection system for the https://iveres.es project.

The main components of the system are:
* **Common functionalities** to download videos, transcribe and detect fakes.
* **Airflow workflow** to orchestrate the execution of all the modules.
* **Web application** to setup and visualize the monitoring and manually upload media.
* **MongoDB database** to store all the generated data.

**Screenshots**

Airflow UI.
![Airflow](<images/Screenshot IVERES airflow.png>)

Web app monitoring list.
![Web list](<images/Screenshot IVERES web list.png>)

Web app upload page.
![Web upload](<images/Screenshot IVERES web upload.png>)

Web app media page.
![Web media](<images/Screenshot IVERES web media.png>)

## Packages used

- Transcription:
    - Speech to text: https://github.com/SYSTRAN/faster-whisper
    - Translation: https://github.com/Helsinki-NLP/Opus-MT
- Fake video detection:
    - deepfake-scanner: https://github.com/Hook35/deepfake-scanner
    - Video Face Manipulation Detection Through Ensemble of CNNs: https://github.com/polimi-ispl/icpr2020dfdc
- Fake image detection: https://huggingface.co/Organika/sdxl-detector

## Environment setup

To clone the full project with submodules you can use `--recurse-submodules`:

```bash
git clone --recurse-submodules <main_repo_url>
```

Configuration file: `.env`

### Project structure

* `common`: common modules for the database, video downloading, fake detection etc.
* `dags`: airflow dags.
* `data`: videos data.
* `envs`: python virtual envs to run the modules.
* `scripts`: additional scripts.
* `services`: airflow services.
* `web_app`: backend and frontend for the web application.

### Global requirements

* `mongodb`
* `ffmpeg`

### Airflow workflow

#### Installation

**Envs**

Create envs `bash scripts/create_envs.sh`

Old Cuda 11 workaround for `common/transcription/requirements.txt`:
- `source envs/env_transcribe/bin/activate`
- `pip install faster-whisper==1.0.3`
- `pip install ctranslate2==3.24.0`

**Models**

* Transcription: `bash common/transcription/download_models.sh`
* Deepware: `bash common/fakes_deepware/download_weights.sh`
* Fake segments (manual): `common/fakes_segment/models/mit-b0_fi_checkpoint-97100`

**Airflow**

Development:
`airflow standalone`

Setup using mysql backend:
1. Run `airflow --help`
2. Edit: `~/airflow/airflow.cfg`
    * `dags_folder = /path/to/iveres_workflow/dags`
    * `executor = LocalExecutor`
    * `load_examples = False`
    * `sql_alchemy_conn = mysql+mysqldb://airflow_user:airflow_pass@localhost/airflow_db`
    * `base_url = http://localhost:8082`
    * `web_server_port = 8082`
    * `endpoint_url = http://localhost:8082`
3. Install `mysql` on system: `sudo apt install mysql-server`, ...
4. Setup database as explained here https://airflow.apache.org/docs/apache-airflow/stable/howto/set-up-database.html#setting-up-a-mysql-database
5. `airflow db upgrade`
6. `airflow users create --role Admin --username admin --email admin --firstname admin --lastname admin --password admin`

Airflow systemd services:
1. Copy sample files:
    * `cp services/airflow.env /home/user/airflow/`
    * `sudo cp services/airflow-webserver.service /lib/systemd/system/`
    * `sudo cp services/airflow-scheduler.service /lib/systemd/system/`
2. Edit vars from:
    * Paths (user) from: `/home/user/airflow/airflow.env`
    * EnvironmentFile, User, Group and ExecStart:
        * `sudo nano /lib/systemd/system/airflow-webserver.service`
        * `sudo nano /lib/systemd/system/airflow-scheduler.service`
3. Start or enable services:
    * `sudo systemctl start airflow-webserver.service`
    * `sudo systemctl start airflow-scheduler.service`

### Web application

#### Install

* nodejs 20: `https://github.com/nodesource/distributions#installation-instructions`

* Backend
    1. `cd web_app/backend/`
    2. `npm i`
* Frontend
    1. `cd web_app/frontend/`
    2. `npm i`

* Add SSL certificates: 
    * `web_app/backend/certs/selfsigned.key`
    * `web_app/backend/certs/selfsigned.crt`

#### Run dev

* Backend
    1. `cd backend/`
    2. `npm start`
* Frontend
    1. `cd frontend/`
    2. `npm start`

#### Run production

Install pm2: 
1. `sudo npm install pm2@latest -g`
2. `pm2 startup`

Add app to pm2:
1. `cd web_app/frontend && npm run build`: build frontend
2. `cd ../backend`: go to backend
3. `pm2 start npm --name iveres-monitor --time -- start`: start pm2
4. `pm2 save`: save pm2 config

#### Users

The roles and permissions for web application users are the following:

| Role     | View videos | Upload videos | Edit config | Permissions code |
| ---      | ---         | ---           | ---         | ---              |
| viewer   | ✓           | ✕             | ✕           | 1                |
| uploader | ✓           | ✓             | ✕           | 3                |
| editor   | ✓           | ✓             | ✓           | 7                |

The creation of new users is done manually for now. You can use the `node.js` script `web_app/backend/db/manualAddUser.js`. For example running:
```bash
node web_app/backend/db/manualAddUser.js username editor
```

#### REST API endpoints

* `/resources`: video files (videos, subtitles, ...)
    * [GET] `/resources/...path`: public video files
* `/api/watchlist`: watchlist to monitor
    * [GET] `/api/watchlist`: get watchlist
    * [POST] `/api/watchlist`: post account to watchlist
    * [DELETE] `/api/watchlist/:id`: delete account from watchlist
* `/api/request`: requested videos
    * [GET] `/api/request`: get all requests info
    * [GET] `/api/request/:id`: get request info
    * [POST] `/api/request`: post a request link
* `/api/media`: downloaded media
    * [GET] `/api/media?page=0&size=100`: get list of media
    * [GET] `/api/media/:id`: get media info
    * [POST] `/api/media`: post a media file

### Database

The MongoDB database structure is as follows:

* iveres_monitor
    * watchlist
        * platform {youtube, tiktok}
        * channelId
        * channelName
        * monitoringUsers
            * userId
            * subscribeDatetime
    * requests
        * source {tiktokMonitor, youtubeMonitor, manualRequest}
        * userId
        * url
        * requestDatetime
        * priority
        * status {requested, downloaded, error}
        * errorMessage
        * videoId
        * analysisEnabled
            * transcribe
            * fake
    * videos -> media
        * requests
            * source {tiktokMonitor, youtubeMonitor, manualRequest, fileUpload}
            * userId
            * url
            * requestDatetime
            * priority
            * analysisEnabled
                * transcribe
                * fake
        * priority
        * analysisStatus
            * transcribe {disabled, waiting, done, error}
            * fake {disabled, waiting, done, error}
        * platform {youtube, tiktok, ..., file}
        * status {downloaded, transcribed, analyzed, stored, archived, error?}
        * path
        * downloadDatetime
        * mediaType {"video", "audio", "image"}
        * platformMetadata
            * // youtube / tiktok / ... //
            * videoId
            * videoUrl
            * uploader
            * uploaderId
            * uploadDatetime
            * title
            * description
            * duration
            * ?thumbnailPath
            * ...
            * // file //
            * uploader
            * uploadDatetime
            * title
            * modifiedDatetime
            * originFilename
            * duration
            * ...
        * extractedMetadata
            * transcriptions
                * srcLang
                * data
                    * langA
                        * type {transcribe, speechTranslate, textTranslate}
                        * language
                        * text
                        * segments[]
                            * text
                            * start
                            * end
                        * filesPath
                            * json
                            * srt
                            * tsv
                            * txt
                            * vtt
            * fakes
                * deepware
                * polimi
                    * score
                    * figure
                * ldire
                    * score
                    * figure
                * organika
                    * score
                * ...
            * ...
    * users
        * username
        * role
        * created
        * hashedPassword
        * salt
