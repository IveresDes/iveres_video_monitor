#!/bin/bash

# Tested with python3.10 but you can try with other versions

# Main env
python3.10 -m venv envs/env_airflow
source envs/env_airflow/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r requirements.txt
# In some cases
# sudo apt install libsqlite3-dev
# sudo apt-get install python3-dev default-libmysqlclient-dev build-essential
deactivate

# Gather env
python3.10 -m venv envs/env_gather
source envs/env_gather/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r common/gather_tiktok/requirements.txt
python -m pip install -r common/gather_youtube/requirements.txt
python -m pip install -r common/database/requirements.txt
# Playwright setup
playwright install
# If needed follow the instructions for the missing components.
# * playwright install
# * sudo apt install libdbus-glib-1-2
# * ...
deactivate

# Transcribe env
python3.10 -m venv envs/env_transcribe
source envs/env_transcribe/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r common/transcription/requirements.txt
deactivate

# Fakes env
python3.10 -m venv envs/env_fakes
source envs/env_fakes/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r common/fakes_deepware/requirements.txt
python -m pip install -r common/fakes_polimi/requirements.txt
deactivate

# Fakes image env
python3.10 -m venv envs/env_fakes_image
source envs/env_fakes_image/bin/activate
python -m pip install --upgrade pip setuptools wheel
python -m pip install -r common/fakes_segment/requirements.txt
deactivate
